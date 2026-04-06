/**
 * src/core/sockets/index.js
 *
 * Bootstraps Socket.io:
 *  1. JWT middleware on every connection
 *  2. Registers presence / chat / arena handlers
 *  3. Exports io + onlineMap so services can use them
 */

const { Server }          = require('socket.io')
const { verifyAccess }    = require('../utils/jwt')
const User                = require('../../models/User.model')
const { presenceHandler, onlineMap } = require('./presence.socket')
const chatHandler         = require('./chat.socket')
const { arenaHandler }    = require('./arena.socket')
const logger              = require('../utils/logger')

let ioInstance = null

const initSockets = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin:      'https://qrownd-frontend.vercel.app',
      methods:     ['GET','POST'],
      credentials: true,
    },
    pingTimeout:  60_000,
    pingInterval: 25_000,
    // Allow larger message size for code submissions
    maxHttpBufferSize: 1e6,
  })

  // ── JWT auth middleware ─────────────────────────────────────────────────────
  ioInstance.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
                 || socket.handshake.headers?.authorization?.split(' ')[1]
      if (!token) return next(new Error('AUTH_REQUIRED'))

      let decoded
      try { decoded = verifyAccess(token) }
      catch { return next(new Error('INVALID_TOKEN')) }

      const user = await User.findById(decoded.id)
        .select('_id name handle initials color isActive isBanned isAdmin')
        .lean()

      if (!user || !user.isActive || user.isBanned) return next(new Error('ACCESS_DENIED'))

      socket.userId = user._id.toString()
      socket.user   = user
      next()
    } catch (err) {
      logger.error(`[socket auth] ${err.message}`)
      next(new Error('AUTH_FAILED'))
    }
  })

  // ── Connection ──────────────────────────────────────────────────────────────
  ioInstance.on('connection', (socket) => {
    logger.debug(`[socket] connect ${socket.id} user:${socket.userId}`)

    presenceHandler(ioInstance, socket)
    chatHandler(ioInstance, socket)
    arenaHandler(ioInstance, socket)
  })

  return ioInstance
}

const getIO = () => ioInstance

module.exports = { initSockets, getIO, onlineMap }
