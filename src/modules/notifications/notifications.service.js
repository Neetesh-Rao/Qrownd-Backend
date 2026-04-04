// notifications.service.js
const Notification = require('../../models/Notification.model')

const getNotifications = async (userId, page=1, limit=20) => {
  const skip = (page-1)*limit
  const [notifications, total, unread] = await Promise.all([
    Notification.find({ recipient:userId }).sort({createdAt:-1}).skip(skip).limit(limit).lean(),
    Notification.countDocuments({ recipient:userId }),
    Notification.countDocuments({ recipient:userId, read:false }),
  ])
  return { notifications, total, unread }
}

const markAllRead = (userId) =>
  Notification.updateMany({ recipient:userId, read:false }, { $set:{ read:true } })

const markOneRead = (id, userId) =>
  Notification.findOneAndUpdate({ _id:id, recipient:userId }, { read:true })

const deleteOld = async (days=30) => {
  const r = await Notification.deleteMany({ createdAt:{ $lt:new Date(Date.now()-days*86_400_000) } })
  return r.deletedCount
}

module.exports = { getNotifications, markAllRead, markOneRead, deleteOld }
