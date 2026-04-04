const svc = require('./notifications.service')
const api = require('../../core/utils/apiResponse')

const getNotifications = async (req,res,next) => {
  try {
    const { page=1,limit=20 } = req.query
    const r = await svc.getNotifications(req.user._id, +page, +limit)
    return res.status(200).json({
      success:true, message:'Success',
      data:{ unread:r.unread },
      notifications: r.notifications,
      pagination:{ page:+page, limit:+limit, total:r.total, totalPages:Math.ceil(r.total/limit) },
      timestamp: new Date().toISOString(),
    })
  } catch(e){next(e)}
}

const markAllRead = async (req,res,next) => { try { await svc.markAllRead(req.user._id); return api.success(res,{},'All marked read') } catch(e){next(e)} }
const markOneRead = async (req,res,next) => { try { await svc.markOneRead(req.params.id,req.user._id); return api.success(res,{},'Marked read') } catch(e){next(e)} }

module.exports = { getNotifications, markAllRead, markOneRead }
