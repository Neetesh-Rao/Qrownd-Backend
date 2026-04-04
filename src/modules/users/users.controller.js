// users.controller.js
const svc = require('./users.service')
const api = require('../../core/utils/apiResponse')

const getProfile     = async (req,res,next) => { try { return api.success(res,{user:await svc.getProfile(req.params.handle)}) } catch(e){next(e)} }
const updateProfile  = async (req,res,next) => { try { return api.success(res,{user:await svc.updateProfile(req.user._id,req.body)},'Profile updated') } catch(e){next(e)} }
const uploadAvatar   = async (req,res,next) => {
  try {
    if (!req.file) return api.badRequest(res,'No image uploaded')
    return api.success(res,{user:await svc.uploadAvatar(req.user._id,req.file.buffer,req.file.mimetype)},'Avatar updated')
  } catch(e){next(e)}
}
const getLeaderboard = async (req,res,next) => {
  try {
    const { page=1,limit=20 } = req.query
    const r = await svc.getLeaderboard(+page,+limit)
    return api.paginated(res,r.users,page,limit,r.total)
  } catch(e){next(e)}
}
const addBookmark    = async (req,res,next) => { try { await svc.addBookmark(req.user._id,req.params.postId);    return api.success(res,{},'Bookmarked') } catch(e){next(e)} }
const removeBookmark = async (req,res,next) => { try { await svc.removeBookmark(req.user._id,req.params.postId); return api.success(res,{},'Removed') } catch(e){next(e)} }
const getBookmarks   = async (req,res,next) => { try { return api.success(res,{posts:await svc.getBookmarks(req.user._id)}) } catch(e){next(e)} }
const getUserPosts   = async (req,res,next) => {
  try {
    const { page=1,limit=10 } = req.query
    const r = await svc.getUserPosts(req.params.handle,+page,+limit)
    return api.paginated(res,r.posts,page,limit,r.total)
  } catch(e){next(e)}
}

module.exports = { getProfile, updateProfile, uploadAvatar, getLeaderboard, addBookmark, removeBookmark, getBookmarks, getUserPosts }
