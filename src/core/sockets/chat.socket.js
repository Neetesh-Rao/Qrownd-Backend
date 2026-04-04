/**
 * src/core/sockets/chat.socket.js
 *
 * Real-time 1-to-1 chat.
 * – Messages are persisted to DB inside chatService.saveMessage()
 * – If recipient online  → socket delivery
 * – If recipient offline → FCM push via notifier.sendFCM()
 */

const chatService           = require('../../modules/chat/chat.service')
const { onlineMap }         = require('./presence.socket')
const { sendFCM }           = require('../utils/notifier')
const User                  = require('../../models/User.model')
const logger                = require('../utils/logger')

const chatHandler = (io, socket) => {
  const uid = socket.userId

  // ── Send message ───────────────────────────────────────────────────────────
  socket.on('chat:send', async ({ toUserId, text }) => {
    if (!toUserId || !text?.trim()) return socket.emit('chat:error', { message: 'toUserId and text are required' })

    try {
      // 1. Persist
      const msg = await chatService.saveMessage(uid, toUserId, text)

      const payload = {
        _id:       msg._id,
        from:      { _id: uid, name: socket.user.name, initials: socket.user.initials, color: socket.user.color, handle: socket.user.handle },
        to:        { _id: toUserId },
        text:      msg.text,
        createdAt: msg.createdAt,
        read:      false,
      }

      // 2. Deliver to recipient's open tabs
      const recipientSids = [...(onlineMap.get(toUserId.toString()) || [])]
      recipientSids.forEach(sid => io.to(sid).emit('chat:message', payload))

      // 3. Echo to sender's other tabs
      const senderSids = [...(onlineMap.get(uid) || [])].filter(s => s !== socket.id)
      senderSids.forEach(sid => io.to(sid).emit('chat:message', { ...payload, echo: true }))

      // 4. Ack to sender
      socket.emit('chat:sent', { tempId: msg._id, message: payload })

      // 5. If recipient offline → FCM push
      if (recipientSids.length === 0) {
        const recipient = await User.findById(toUserId).select('fcmToken').lean()
        if (recipient?.fcmToken) {
          await sendFCM(
            recipient.fcmToken,
            `${socket.user.name}: ${text.slice(0, 80)}`,
            'message',
            `/chat?with=${uid}`,
            { fromId: uid }
          )
        }
      }

    } catch (err) {
      logger.error(`[chat:send] ${err.message}`)
      socket.emit('chat:error', { message: 'Failed to send message' })
    }
  })

  // ── Typing indicator ───────────────────────────────────────────────────────
  socket.on('chat:typing', ({ toUserId, isTyping }) => {
    if (!toUserId) return
    ;[...(onlineMap.get(toUserId.toString()) || [])].forEach(sid =>
      io.to(sid).emit('chat:typing', { fromUserId: uid, isTyping })
    )
  })

  // ── Mark as read ───────────────────────────────────────────────────────────
  socket.on('chat:markRead', async ({ fromUserId }) => {
    if (!fromUserId) return
    try {
      await chatService.markRead(fromUserId, uid)
      ;[...(onlineMap.get(fromUserId.toString()) || [])].forEach(sid =>
        io.to(sid).emit('chat:read', { byUserId: uid })
      )
    } catch (err) { logger.error(`[chat:markRead] ${err.message}`) }
  })
}

module.exports = chatHandler
