const svc = require('./auth.service')
const api = require('../../core/utils/apiResponse')

const COOKIE = { httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'strict', maxAge:7*24*60*60*1000 }

const register = async (req,res,next) => {
  try {
    const r = await svc.register(req.body)
    res.cookie('refreshToken', r.refreshToken, COOKIE)
    return api.created(res, { user:r.user, accessToken:r.accessToken }, 'Account created')
  } catch(e){ next(e) }
}
const login = async (req,res,next) => {
  try {
    const r = await svc.login(req.body)
    res.cookie('refreshToken', r.refreshToken, COOKIE)
    return api.success(res, { user:r.user, accessToken:r.accessToken }, 'Login successful')
  } catch(e){ next(e) }
}
const refreshToken = async (req,res,next) => {
  try {
    const t = req.cookies?.refreshToken || req.body?.refreshToken
    return api.success(res, await svc.refresh(t), 'Token refreshed')
  } catch(e){ next(e) }
}
const logout = async (req,res,next) => {
  try {
    await svc.logout(req.user._id, req.cookies?.refreshToken || req.body?.refreshToken)
    res.clearCookie('refreshToken')
    return api.success(res, {}, 'Logged out')
  } catch(e){ next(e) }
}
const changePassword = async (req,res,next) => {
  try {
    await svc.changePassword(req.user._id, req.body.currentPassword, req.body.newPassword)
    return api.success(res, {}, 'Password changed')
  } catch(e){ next(e) }
}
const saveFcmToken = async (req,res,next) => {
  try {
    await svc.saveFcmToken(req.user._id, req.body.fcmToken)
    return api.success(res, {}, 'FCM token saved')
  } catch(e){ next(e) }
}
const getMe = async (req,res,next) => {
  try { return api.success(res, { user:req.user.toPublic() }) } catch(e){ next(e) }
}

module.exports = { register, login, refreshToken, logout, changePassword, saveFcmToken, getMe }
