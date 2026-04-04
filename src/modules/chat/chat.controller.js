// chat.controller.js
const svc = require('./chat.service')
const api = require('../../core/utils/apiResponse')

const getInbox = async (req,res,next) => { try { return api.success(res,{conversations:await svc.getInbox(req.user._id)}) } catch(e){next(e)} }
const getConversation = async (req,res,next) => {
  try {
    const { page=1,limit=50 } = req.query
    const r = await svc.getConversation(req.user._id, req.params.userId, +page, +limit)
    await svc.markRead(req.params.userId, req.user._id)
    return api.paginated(res, r.messages, page, limit, r.total)
  } catch(e){next(e)}
}
const getUnreadCount = async (req,res,next) => { try { return api.success(res,{unread:await svc.getUnreadCount(req.user._id)}) } catch(e){next(e)} }

module.exports = { getInbox, getConversation, getUnreadCount }
