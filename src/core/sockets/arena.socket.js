/**
 * src/core/sockets/arena.socket.js
 *
 * Arena real-time game logic.
 * Flow:
 *   User joins room via REST  → server adds to DB, socket joins room channel
 *   Host starts via socket    → countdown 3s → live → timer ticks every second
 *   Player submits via socket → stored in DB, winner announced, timer stops
 *   Player leaves             → removed from room, others notified
 *   Timer hits 0              → room marked finished, no winner
 */

const arenaService  = require('../../modules/arena/arena.service')
const { notify }    = require('../utils/notifier')
const { onlineMap } = require('./presence.socket')
const logger        = require('../utils/logger')

// roomId → { intervalId, remaining, phase }
const roomTimers = new Map()

// ── Stop and clear room timer ──────────────────────────────────────────────────
const clearRoomTimer = (roomId) => {
  const t = roomTimers.get(roomId)
  if (t) { clearInterval(t.intervalId); roomTimers.delete(roomId) }
}

// ── Countdown then live ────────────────────────────────────────────────────────
const startCountdown = (io, roomId, timeLimit) => {
  let count = 3

  const cdInterval = setInterval(() => {
    count -= 1
    io.to(`room:${roomId}`).emit('room:countdown', { remaining: count })

    if (count <= 0) {
      clearInterval(cdInterval)
      io.to(`room:${roomId}`).emit('room:live', { startedAt: new Date().toISOString() })
      startGameTimer(io, roomId, timeLimit)
    }
  }, 1000)
}

const startGameTimer = (io, roomId, timeLimit) => {
  let remaining = timeLimit

  const gameInterval = setInterval(async () => {
    remaining -= 1
    io.to(`room:${roomId}`).emit('room:tick', { remaining })

    if (remaining <= 0) {
      clearRoomTimer(roomId)
      // Update DB
      await arenaService.expireRoom(roomId).catch(() => {})
      io.to(`room:${roomId}`).emit('room:expired', { roomId, message: "Time's up! No winner this round." })
      logger.info(`[arena] room [${roomId}] expired by timer`)
    }
  }, 1000)

  roomTimers.set(roomId, { intervalId: gameInterval, remaining })
}

// ── Per-socket handler ─────────────────────────────────────────────────────────
const arenaHandler = (io, socket) => {
  const uid = socket.userId

  // ── Join room's socket channel (called after REST join succeeds) ────────────
  socket.on('arena:joinRoom', ({ roomId }) => {
    if (!roomId) return
    socket.join(`room:${roomId}`)
    // Tell room someone is in
    socket.to(`room:${roomId}`).emit('room:playerOnline', {
      userId:   uid,
      name:     socket.user.name,
      initials: socket.user.initials,
      color:    socket.user.color,
    })
    logger.debug(`[arena] socket ${socket.id} joined room:${roomId}`)
  })

  // ── Leave room ──────────────────────────────────────────────────────────────
  socket.on('arena:leaveRoom', async ({ roomId }) => {
    if (!roomId) return
    socket.leave(`room:${roomId}`)
    io.to(`room:${roomId}`).emit('room:playerLeft', { userId: uid, name: socket.user.name })
    await arenaService.leaveRoom(roomId, uid).catch(() => {})
    logger.debug(`[arena] ${uid} left room:${roomId}`)
  })

  // ── Host starts the match ───────────────────────────────────────────────────
  socket.on('arena:start', async ({ roomId }) => {
    try {
      const room = await arenaService.startRoom(roomId, uid)

      // Broadcast to room: who's playing
      io.to(`room:${roomId}`).emit('room:starting', {
        challenge: room.challenge,
        players:   room.players
          .filter(p => p.status !== 'left')
          .map(p => ({ user: p.user, name: p.name, initials: p.initials, color: p.color, status: p.status })),
      })

      startCountdown(io, roomId, room.challenge?.timeLimit || 300)
      logger.info(`[arena] room [${roomId}] started by ${uid}`)

    } catch (err) {
      socket.emit('arena:error', { message: err.message })
    }
  })

  // ── Player submits answer ───────────────────────────────────────────────────
  socket.on('arena:submit', async ({ roomId, answer }) => {
    if (!roomId || !answer?.trim()) return socket.emit('arena:error', { message: 'roomId and answer required' })

    try {
      const result = await arenaService.submitAnswer(roomId, uid, answer, io, onlineMap)

      // Tell room this player finished
      io.to(`room:${roomId}`).emit('room:playerDone', {
        userId:   uid,
        name:     socket.user.name,
        initials: socket.user.initials,
        xpEarned: result.xpEarned,
        elapsed:  result.elapsed,
      })

      // If first winner → announce and stop timer
      if (result.isFirst) {
        clearRoomTimer(roomId)
        io.to(`room:${roomId}`).emit('room:winner', {
          winner: { id: uid, name: socket.user.name, initials: socket.user.initials },
          xpAwarded: result.xpEarned,
          elapsed:   result.elapsed,
        })
        logger.info(`[arena] 🏆 winner ${uid} in room [${roomId}] +${result.xpEarned}XP`)
      }

      socket.emit('arena:submitAck', { isFirst: result.isFirst, xpEarned: result.xpEarned, elapsed: result.elapsed })

    } catch (err) {
      logger.error(`[arena:submit] ${err.message}`)
      socket.emit('arena:error', { message: err.message })
    }
  })

    // ── Join post detail room (for real-time answer updates) ──────────────────
  socket.on('post:join', ({ postId }) => {
    if (postId) socket.join(`post:${postId}`)
  })

  // ── Request current room state (useful on reconnect) ────────────────────────
  socket.on('arena:getRoom', async ({ roomId }) => {
    try {
      const room = await arenaService.getRoomById(roomId)
      socket.emit('arena:roomState', { room })
    } catch (_) {}
  })
}

module.exports = { arenaHandler, clearRoomTimer, startCountdown }
