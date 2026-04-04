/**
 * src/core/sockets/presence.socket.js
 *
 * Tracks which users are online.
 * onlineMap: Map<userId(string) → Set<socketId(string)>>
 *
 * Exported so notifier.js can check online status before deciding socket vs FCM.
 */

const logger = require('../utils/logger')

// This Map is the source of truth for online users
const onlineMap = new Map()

const isOnline    = (uid) => onlineMap.has(uid?.toString()) && onlineMap.get(uid.toString()).size > 0
const getSocketIds= (uid) => [...(onlineMap.get(uid?.toString()) || [])]
const getOnlineIds= ()    => [...onlineMap.keys()]

const presenceHandler = (io, socket) => {
  const uid = socket.userId

  // Add to map
  if (!onlineMap.has(uid)) onlineMap.set(uid, new Set())
  onlineMap.get(uid).add(socket.id)
  logger.debug(`[presence] + ${uid} (${onlineMap.get(uid).size} connections)`)

  // Tell everyone this user is online
  socket.broadcast.emit('presence:online', { userId: uid })

  // Tell caller the current online list
  socket.emit('presence:list', { onlineIds: getOnlineIds() })

  // On disconnect
  socket.on('disconnect', (reason) => {
    logger.debug(`[socket] disconnect ${socket.id} reason=${reason}`)
    if (!onlineMap.has(uid)) return
    onlineMap.get(uid).delete(socket.id)
    if (onlineMap.get(uid).size === 0) {
      onlineMap.delete(uid)
      io.emit('presence:offline', { userId: uid })
      logger.debug(`[presence] - ${uid} fully offline`)
    }
  })
}

module.exports = { presenceHandler, onlineMap, isOnline, getSocketIds, getOnlineIds }
