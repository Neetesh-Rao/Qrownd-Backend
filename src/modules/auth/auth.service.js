const User                                              = require('../../models/User.model')
const { signAccess, signRefresh, verifyRefresh }        = require('../../core/utils/jwt')
const logger                                            = require('../../core/utils/logger')

const _err = (m,s=400) => { const e=new Error(m); e.status=s; return e }
const _tok = (user) => ({ accessToken:signAccess({id:user._id}), refreshToken:signRefresh({id:user._id}) })

const register = async ({ name, handle, email, password, interests=[], skills=[] }) => {
  const exists = await User.findOne({ $or:[{email},{handle}] })
  if (exists) throw _err(`${exists.email===email?'Email':'Handle'} already in use`, 409)

  const user = await User.create({ name, handle, email, password, interests, skills })
  user.updateStreak()
  const t = _tok(user)
  user.refreshTokens.push(t.refreshToken)
  await user.save({ validateBeforeSave:false })
  logger.info(`Registered: ${handle}`)
  return { user:user.toPublic(), ...t }
}

const login = async ({ email, password, fcmToken }) => {
  const user = await User.findOne({ email }).select('+password +refreshTokens +fcmToken')
  if (!user || !(await user.comparePassword(password))) throw _err('Invalid email or password', 401)
  if (!user.isActive) throw _err('Account deactivated', 403)
  if (user.isBanned)  throw _err('Account banned', 403)

  user.updateStreak()
  if (fcmToken) user.fcmToken = fcmToken

  const t = _tok(user)
  user.refreshTokens.push(t.refreshToken)
  if (user.refreshTokens.length>5) user.refreshTokens = user.refreshTokens.slice(-5)
  await user.save({ validateBeforeSave:false })
  logger.info(`Login: ${user.handle}`)
  return { user:user.toPublic(), ...t }
}

const refresh = async (token) => {
  if (!token) throw _err('Refresh token missing', 401)
  let decoded
  try { decoded = verifyRefresh(token) } catch { throw _err('Invalid or expired refresh token', 401) }
  const user = await User.findById(decoded.id).select('+refreshTokens')
  if (!user || !user.refreshTokens.includes(token)) throw _err('Refresh token revoked', 401)
  return { accessToken: signAccess({id:user._id}) }
}

const logout = async (userId, token) => {
  await User.findByIdAndUpdate(userId, { $pull:{ refreshTokens:token } })
}

const changePassword = async (userId, current, next) => {
  const user = await User.findById(userId).select('+password')
  if (!(await user.comparePassword(current))) throw _err('Current password incorrect', 400)
  user.password = next
  user.refreshTokens = []
  await user.save()
}

const saveFcmToken = async (userId, fcmToken) => {
  await User.findByIdAndUpdate(userId, { fcmToken })
}

module.exports = { register, login, refresh, logout, changePassword, saveFcmToken }
