/**
 * src/core/utils/notifier.js
 *
 * Smart notification dispatcher:
 *   – If recipient is ONLINE  → emit via Socket.io (instant, no cost)
 *   – If recipient is OFFLINE → send via Firebase FCM (push notification)
 *
 * Usage:
 *   const { notify } = require('./notifier')
 *   await notify({ recipientId, type, message, link, data, io, onlineUsers })
 */

const admin  = require('firebase-admin')
const logger = require('./logger')
const Notification = require('../../models/Notification.model')

// FCM icon map per notification type
const FCM_ICONS = {
  answer:     '💬',
  upvote:     '▲',
  accept:     '✅',
  game_start: '⚔️',
  game_win:   '🏆',
  message:    '📩',
  rank_up:    '📈',
  system:     '🔔',
}

/**
 * Main notify function.
 * @param {Object} opts
 * @param {string}   opts.recipientId   – Mongoose ObjectId string
 * @param {string}   opts.type          – notification type key
 * @param {string}   opts.message       – human-readable message
 * @param {string}   [opts.link]        – frontend route (e.g. /post/abc)
 * @param {Object}   [opts.data]        – extra payload
 * @param {Object}   opts.io            – Socket.io server instance
 * @param {Map}      opts.onlineMap     – Map<userId→Set<socketId>> from presence
 * @param {string}   [opts.fcmToken]    – recipient's FCM token (for offline push)
 */
const notify = async ({ recipientId, type, message, link=null, data={}, io, onlineMap, fcmToken }) => {
  const rid = recipientId?.toString()
  if (!rid) return

  // 1. Always persist to DB
  let savedNotif
  try {
    savedNotif = await Notification.create({ recipient: rid, type, message, link, data })
  } catch (err) {
    logger.error(`[notifier] DB save failed: ${err.message}`)
  }

  const payload = {
    _id:       savedNotif?._id,
    type,
    message,
    link,
    data,
    read:      false,
    createdAt: savedNotif?.createdAt || new Date().toISOString(),
  }

  // 2. Check if user is online
  const isOnline = onlineMap && onlineMap.has(rid) && onlineMap.get(rid).size > 0

  if (isOnline && io) {
    // → Socket delivery (instant)
    const sids = [...(onlineMap.get(rid) || [])]
    sids.forEach(sid => io.to(sid).emit('notification', payload))
    logger.debug(`[notifier] socket → ${rid} (${type})`)
  } else if (fcmToken) {
    // → Firebase FCM push (offline)
    await sendFCM(fcmToken, message, type, link, data)
    logger.debug(`[notifier] fcm → ${rid} (${type})`)
  }
}

/**
 * Notify multiple recipients at once (e.g. new post broadcast).
 * @param {Array<{recipientId, fcmToken}>} recipients
 * @param {Object} opts  – same as notify() minus recipientId/fcmToken
 */
const notifyMany = async (recipients, { type, message, link, data, io, onlineMap }) => {
  if (!recipients?.length) return
  await Promise.all(
    recipients.map(({ recipientId, fcmToken }) =>
      notify({ recipientId, type, message, link, data, io, onlineMap, fcmToken })
    )
  )
}

// ── Firebase FCM send ─────────────────────────────────────────────────────────
const sendFCM = async (token, body, type, link, extraData = {}) => {
  if (!token || admin.apps.length === 0) return
  try {
    await admin.messaging().send({
      token,
      notification: { title: 'Qrownd', body },
      data: {
        type,
        link:  link || '/',
        ...Object.fromEntries(Object.entries(extraData).map(([k,v])=>[k,String(v)])),
      },
      webpush: {
        notification: {
          title: 'Qrownd',
          body,
          icon:  '/favicon.ico',
          badge: '/favicon.ico',
          tag:   type,
        },
        fcm_options: { link: `${process.env.FRONTEND_URL || '/'}${link || ''}` },
      },
    })
  } catch (err) {
    logger.warn(`[notifier] FCM failed: ${err.message}`)
  }
}

// ── Convenience wrappers (used from services) ─────────────────────────────────

/** Someone posted a new problem → notify ALL online users except poster */
const notifyNewPost = async ({ postId, postTitle, posterName, excludeId, io, onlineMap, allUsers }) => {
  // Only notify users who are online (don't spam FCM for a new post to everyone)
  if (!io || !onlineMap) return
  for (const [uid, sids] of onlineMap.entries()) {
    if (uid === excludeId?.toString()) continue
    sids.forEach(sid => io.to(sid).emit('notification', {
      type:    'new_post',
      message: `${posterName} posted a new problem`,
      link:    `/post/${postId}`,
      data:    { postId, postTitle },
      read:    false,
      createdAt: new Date().toISOString(),
    }))
  }
}

module.exports = { notify, notifyMany, notifyNewPost, sendFCM }
