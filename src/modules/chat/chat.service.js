const Message  = require('../../models/Message.model')
const User     = require('../../models/User.model')
const mongoose = require('mongoose')

const _err = (m,s=400) => { const e=new Error(m); e.status=s; return e }

const saveMessage = async (fromId, toId, text) => {
  if (!text?.trim()) throw _err('Message cannot be empty')
  const [from, to] = await Promise.all([User.findById(fromId).select('_id'), User.findById(toId).select('_id')])
  if (!from) throw _err('Sender not found', 404)
  if (!to)   throw _err('Recipient not found', 404)
  return Message.create({ from:fromId, to:toId, text:text.trim() })
}

const getConversation = async (uid1, uid2, page=1, limit=50) => {
  const skip = (page-1)*limit
  const filter = { $or:[{from:uid1,to:uid2},{from:uid2,to:uid1}] }
  const [messages, total] = await Promise.all([
    Message.find(filter).sort({createdAt:-1}).skip(skip).limit(limit)
      .populate('from','name handle initials color').populate('to','name handle initials color').lean(),
    Message.countDocuments(filter),
  ])
  return { messages:messages.reverse(), total }
}

const getInbox = async (userId) => {
  const uid = typeof userId==='string' ? new mongoose.Types.ObjectId(userId) : userId
  const inbox = await Message.aggregate([
    { $match:{ $or:[{from:uid},{to:uid}] } },
    { $sort:{ createdAt:-1 } },
    { $group:{
      _id:{ $cond:[{$lt:['$from','$to']},{a:'$from',b:'$to'},{a:'$to',b:'$from'}] },
      lastMessage:{ $first:'$$ROOT' },
      unread:{ $sum:{ $cond:[{$and:[{$eq:['$to',uid]},{$eq:['$read',false]}]},1,0] } },
    }},
    { $replaceRoot:{ newRoot:{ $mergeObjects:['$lastMessage',{unreadCount:'$unread'}] } } },
    { $sort:{ createdAt:-1 } },
    { $limit:30 },
  ])
  await Message.populate(inbox,[{path:'from',select:'name handle initials color'},{path:'to',select:'name handle initials color'}])
  return inbox
}

const markRead = async (fromId, toId) => {
  await Message.updateMany({ from:fromId, to:toId, read:false }, { $set:{ read:true } })
}

const getUnreadCount = (userId) => Message.countDocuments({ to:userId, read:false })

module.exports = { saveMessage, getConversation, getInbox, markRead, getUnreadCount }
