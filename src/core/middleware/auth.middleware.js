const { verifyAccess } = require('../utils/jwt')
const User             = require('../../models/User.model')
const { unauthorized, forbidden } = require('../utils/apiResponse')
const logger           = require('../utils/logger')

const protect = async (req, res, next) => {
  try {
    let token = null
    if (req.headers.authorization?.startsWith('Bearer ')) token = req.headers.authorization.split(' ')[1]
    else if (req.cookies?.accessToken) token = req.cookies.accessToken
    if (!token) return unauthorized(res, 'No token – please login')

    let decoded
    try { decoded = verifyAccess(token) }
    catch (err) {
      if (err.name === 'TokenExpiredError') return unauthorized(res, 'Token expired – please refresh')
      return unauthorized(res, 'Invalid token')
    }

    const user = await User.findById(decoded.id).select('+fcmToken')
    if (!user)          return unauthorized(res, 'User not found')
    if (!user.isActive) return unauthorized(res, 'Account deactivated')
    if (user.isBanned)  return unauthorized(res, 'Account banned')

    req.user = user
    next()
  } catch (err) {
    logger.error(`[auth] ${err.message}`)
    return unauthorized(res)
  }
}

const optionalAuth = async (req, res, next) => {
  try {
    let token = null
    if (req.headers.authorization?.startsWith('Bearer ')) token = req.headers.authorization.split(' ')[1]
    else if (req.cookies?.accessToken) token = req.cookies.accessToken
    if (!token) return next()
    const decoded = verifyAccess(token)
    req.user = await User.findById(decoded.id)
  } catch (_) {}
  next()
}

const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) return forbidden(res, 'Admin access required')
  next()
}

module.exports = { protect, optionalAuth, requireAdmin }
