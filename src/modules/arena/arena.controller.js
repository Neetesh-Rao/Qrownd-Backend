const svc = require('./arena.service')
const api = require('../../core/utils/apiResponse')
const { getIO } = require('../../core/sockets/index')
const { clearRoomTimer, startCountdown } = require('../../core/sockets/arena.socket')

// ── Challenges ────────────────────────────────────────────────────────────────
const createChallenge = async (req,res,next) => {
  try { return api.created(res,{challenge:await svc.createChallenge(req.user._id,req.body)},'Challenge created') } catch(e){next(e)}
}
const getChallenges = async (req,res,next) => {
  try {
    const { page=1,limit=20,category,difficulty } = req.query
    const r = await svc.getChallenges({page:+page,limit:+limit,category,difficulty})
    return api.paginated(res,r.challenges,page,limit,r.total)
  } catch(e){next(e)}
}
const deleteChallenge = async (req,res,next) => {
  try { await svc.deleteChallenge(req.params.id); return api.success(res,{},'Challenge deactivated') } catch(e){next(e)}
}

// ── Rooms ─────────────────────────────────────────────────────────────────────
const getRooms = async (req,res,next) => {
  try { return api.success(res,{rooms:await svc.getRooms()}) } catch(e){next(e)}
}

const createRoom = async (req,res,next) => {
  try {
    const room = await svc.createRoom(req.user._id, req.body)
    // Broadcast new room to all connected clients
    getIO()?.emit('arena:roomCreated', { room })
    return api.created(res,{room},'Room created')
  } catch(e){next(e)}
}

/**
 * REST join — persists player to DB.
 * Frontend then emits arena:joinRoom via socket to get into the room channel.
 */
const joinRoom = async (req,res,next) => {
  try {
    const room = await svc.joinRoom(req.params.id, req.user._id)
    // Notify room via socket
    getIO()?.to(`room:${req.params.id}`).emit('room:playerJoined', {
      user: req.user.toPublic(),
    })
    return api.success(res,{room},'Joined room')
  } catch(e){next(e)}
}

/**
 * REST start — host triggers this.
 * Could also be triggered via socket (arena:start event in arena.socket.js).
 */
const startRoom = async (req,res,next) => {
  try {
    const room = await svc.startRoom(req.params.id, req.user._id)
    const io   = getIO()
    if (io) {
      io.to(`room:${req.params.id}`).emit('room:starting', {
        challenge: room.challenge,
        players:   room.players.filter(p=>p.status!=='left').map(p=>({
          user:p.user, name:p.name, initials:p.initials, color:p.color, status:p.status,
        })),
      })
      startCountdown(io, req.params.id, room.challenge?.timeLimit || 300)
    }
    return api.success(res,{room},'Match starting!')
  } catch(e){next(e)}
}

/**
 * REST submit — persists answer to DB.
 * Socket submit (arena:submit) is preferred for real-time; both paths work.
 */
const submitAnswer = async (req,res,next) => {
  try {
    const result = await svc.submitAnswer(req.params.id, req.user._id, req.body.answer)
    const io     = getIO()
    if (io) {
      io.to(`room:${req.params.id}`).emit('room:playerDone',{
        userId:   req.user._id,
        name:     req.user.name,
        initials: req.user.initials,
        xpEarned: result.xpEarned,
        elapsed:  result.elapsed,
      })
      if (result.isFirst) {
        clearRoomTimer(req.params.id)
        io.to(`room:${req.params.id}`).emit('room:winner',{
          winner:    { id:req.user._id, name:req.user.name, initials:req.user.initials },
          xpAwarded: result.xpEarned,
          elapsed:   result.elapsed,
        })
      }
    }
    return api.success(res,{ isFirst:result.isFirst, xpEarned:result.xpEarned },'Submitted!')
  } catch(e){next(e)}
}

module.exports = { createChallenge, getChallenges, deleteChallenge, getRooms, createRoom, joinRoom, startRoom, submitAnswer }
