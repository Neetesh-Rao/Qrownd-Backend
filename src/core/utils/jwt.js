const jwt = require('jsonwebtoken')
const signAccess   = (p) => jwt.sign(p, process.env.JWT_SECRET,        { expiresIn: process.env.JWT_EXPIRES_IN         || '15m' })
const signRefresh  = (p) => jwt.sign(p, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN  || '7d'  })
const verifyAccess  = (t) => jwt.verify(t, process.env.JWT_SECRET)
const verifyRefresh = (t) => jwt.verify(t, process.env.JWT_REFRESH_SECRET)
module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh }
