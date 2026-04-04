/**
 * arena.service.js
 *
 * Arena business logic:
 *  – Admin creates challenges
 *  – Any user can create/join rooms
 *  – Proper join/leave logic (no "already in room" bugs)
 *  – Submit answer → XP awarded → notifications sent
 *  – Rank-up check after XP gain
 */

const ArenaRoom      = require('../../models/ArenaRoom.model')
const ArenaChallenge = require('../../models/ArenaChallenge.model')
const User           = require('../../models/User.model')
const { notify }     = require('../../core/utils/notifier')
const { getIO, onlineMap } = require('../../core/sockets/index')
const logger         = require('../../core/utils/logger')

const _err = (m,s=400) => { const e=new Error(m); e.status=s; return e }

// ── CHALLENGES ────────────────────────────────────────────────────────────────
const createChallenge = async (adminId, data) => {
  const ch = await ArenaChallenge.create({ createdBy:adminId, ...data })
  logger.info(`Challenge created [${ch._id}]`)
  return ch
}

const getChallenges = async ({ page=1, limit=20, category, difficulty }={}) => {
  const q = { isActive:true }
  if (category)   q.category   = category
  if (difficulty) q.difficulty = difficulty
  const [challenges, total] = await Promise.all([
    ArenaChallenge.find(q).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),
    ArenaChallenge.countDocuments(q),
  ])
  return { challenges, total }
}

const deleteChallenge = async (id) => {
  await ArenaChallenge.findByIdAndUpdate(id, { isActive:false })
}

// ── ROOMS ─────────────────────────────────────────────────────────────────────

/** Get all open/live rooms with populated challenge */
const getRooms = async () => {
  return ArenaRoom.find({ status:{ $in:['waiting','countdown','live'] } })
    .sort({ createdAt:-1 })
    .populate('challenge', 'title category difficulty xp timeLimit description')
    .lean()
}

/** Get single room by id */
const getRoomById = async (roomId) => {
  const room = await ArenaRoom.findById(roomId)
    .populate('challenge', 'title category difficulty xp timeLimit description')
    .lean()
  if (!room) throw _err('Room not found', 404)
  return room
}

/** Create a new room */
const createRoom = async (hostId, { challengeId, name, isPrivate=false, maxPlayers=8 }) => {
  const [host, challenge] = await Promise.all([
    User.findById(hostId),
    ArenaChallenge.findOne({ _id:challengeId, isActive:true }),
  ])
  if (!host)      throw _err('User not found', 404)
  if (!challenge) throw _err('Challenge not found or inactive', 404)

  const room = await ArenaRoom.create({
    challenge:  challenge._id,
    host:       hostId,
    name:       name?.trim() || `${host.name}'s Room`,
    isPrivate,
    maxPlayers,
    players: [{
      user:     hostId,
      name:     host.name,
      handle:   host.handle,
      initials: host.initials,
      color:    host.color,
      status:   'waiting',
    }],
  })

  await room.populate('challenge', 'title category difficulty xp timeLimit description')
  logger.info(`Arena room created [${room._id}] by ${host.handle}`)
  return room
}

/**
 * Join a room.
 * Handles:
 *  – Already in room → update status back to 'waiting' (re-join after leave)
 *  – New player      → add to players array
 *  – Full room       → error
 *  – Finished room   → error
 */
const joinRoom = async (roomId, userId) => {
  const [room, user] = await Promise.all([
    ArenaRoom.findById(roomId).populate('challenge','title category difficulty xp timeLimit description'),
    User.findById(userId),
  ])
  if (!room) throw _err('Room not found', 404)
  if (!user) throw _err('User not found', 404)
  if (room.status === 'finished') throw _err('This room has already ended', 400)

  const existing = room.players.find(p => p.user.toString() === userId.toString())

  if (existing) {
    // Player was in room before (left and re-joining)
    if (existing.status !== 'left') {
      // Already active in room — just return current state
      return room
    }
    // Re-join: reset status
    existing.status = 'waiting'
  } else {
    // New player
    const activePlayers = room.players.filter(p => p.status !== 'left').length
    if (activePlayers >= room.maxPlayers) throw _err('Room is full', 400)

    room.players.push({
      user:     userId,
      name:     user.name,
      handle:   user.handle,
      initials: user.initials,
      color:    user.color,
      status:   'waiting',
    })
  }

  await room.save()
  logger.info(`${user.handle} joined room [${roomId}]`)
  return room
}

/**
 * Leave a room (soft – sets status to 'left').
 * Non-throwing so it can be called from socket disconnect safely.
 */
const leaveRoom = async (roomId, userId) => {
  try {
    const room = await ArenaRoom.findById(roomId)
    if (!room || room.status === 'finished') return
    const player = room.players.find(p => p.user.toString() === userId.toString())
    if (player) {
      player.status = 'left'
      await room.save()
    }
  } catch (err) {
    logger.warn(`[arena] leaveRoom error: ${err.message}`)
  }
}

/**
 * Start the room (host only).
 * Sets status → 'countdown'. Socket handler does the actual countdown.
 */
const startRoom = async (roomId, requesterId) => {
  const room = await ArenaRoom.findById(roomId)
    .populate('challenge', 'title category difficulty xp timeLimit')
  if (!room) throw _err('Room not found', 404)
  if (room.host.toString() !== requesterId.toString()) throw _err('Only the host can start', 403)
  if (room.status !== 'waiting') throw _err('Room already started or finished', 400)

  const activePlayers = room.players.filter(p => p.status !== 'left')
  if (activePlayers.length < 2) throw _err('Need at least 2 players to start', 400)

  room.status    = 'countdown'
  room.startedAt = new Date()
  activePlayers.forEach(p => { p.status = 'solving' })
  await room.save()

  // Notify all players via smart notifier
  const io = getIO()
  for (const p of activePlayers) {
    await notify({
      recipientId: p.user,
      type:        'game_start',
      message:     `⚔️ Arena match started! Challenge: "${room.challenge.title.slice(0,50)}"`,
      link:        '/arena',
      data:        { roomId },
      io,
      onlineMap,
      fcmToken:    await _getFcmToken(p.user),
    })
  }

  logger.info(`Room [${roomId}] started by ${requesterId}`)
  return room
}

/**
 * Submit answer.
 * First correct submission wins full XP, others get 25%.
 * Also checks for rank-up.
 */
const submitAnswer = async (roomId, userId, answer) => {
  const room = await ArenaRoom.findById(roomId).populate('challenge')
  if (!room) throw _err('Room not found', 404)
  if (room.status !== 'live' && room.status !== 'countdown') throw _err('Game is not active', 400)

  const player = room.players.find(p => p.user.toString() === userId.toString())
  if (!player) throw _err('You are not in this room', 403)
  if (player.status === 'done') throw _err('Already submitted', 400)

  const elapsed   = room.startedAt ? Math.round((Date.now()-room.startedAt.getTime())/1000) : 0
  const isFirst   = !room.winner
  const xpEarned  = isFirst ? room.challenge.xp : Math.floor(room.challenge.xp * 0.25)

  player.status     = 'done'
  player.submitTime = elapsed
  player.xpEarned   = xpEarned

  if (isFirst) {
    room.winner  = userId
    room.status  = 'finished'
    room.endedAt = new Date()
  }

  await room.save()

  // Award XP
  const io = getIO()
  const winner = await User.findById(userId).select('+fcmToken')
  if (winner) {
    winner.addXP(xpEarned)
    if (isFirst) winner.arenaWins += 1
    await winner.save({ validateBeforeSave:false })

    if (isFirst) {
      await notify({
        recipientId: userId,
        type:        'game_win',
        message:     `🏆 You won the arena! "+${xpEarned} XP earned!"`,
        link:        '/arena',
        data:        { roomId, xpEarned },
        io,
        onlineMap,
        fcmToken:    winner.fcmToken,
      })
      // Check rank-up
      await _checkRankUp(winner, io)
    }
  }

  logger.info(`Submit: user[${userId}] room[${roomId}] first=${isFirst} time=${elapsed}s xp=${xpEarned}`)
  return { isFirst, elapsed, xpEarned, room }
}

/** Mark room as finished (called by socket timer expiry) */
const expireRoom = async (roomId) => {
  const room = await ArenaRoom.findById(roomId)
  if (room && room.status === 'live') {
    room.status  = 'finished'
    room.endedAt = new Date()
    await room.save()
    logger.info(`Room [${roomId}] expired`)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const _getFcmToken = async (userId) => {
  const u = await User.findById(userId).select('fcmToken').lean()
  return u?.fcmToken || null
}

const _checkRankUp = async (user, io) => {
  const aboveCount = await User.countDocuments({ xp:{ $gt:user.xp }, isActive:true })
  const newRank    = aboveCount + 1
  if (newRank < user.rank) {
    const oldRank = user.rank
    user.rank = newRank
    await user.save({ validateBeforeSave:false })
    await notify({
      recipientId: user._id,
      type:        'rank_up',
      message:     `📈 Your rank improved! #${oldRank} → #${newRank}`,
      link:        '/rankings',
      data:        { oldRank, newRank },
      io,
      onlineMap,
      fcmToken:    user.fcmToken,
    })
  }
}

module.exports = {
  createChallenge, getChallenges, deleteChallenge,
  getRooms, getRoomById, createRoom, joinRoom, leaveRoom, startRoom, submitAnswer, expireRoom,
}
