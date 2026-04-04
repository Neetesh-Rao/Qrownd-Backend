const router   = require('express').Router()
const ctrl     = require('./auth.controller')
const v        = require('./auth.validation')
const validate = require('../../core/middleware/validate.middleware')
const { protect }     = require('../../core/middleware/auth.middleware')
const { authLimiter } = require('../../core/middleware/rateLimiter.middleware')

router.post('/register',        authLimiter, v.register,        validate, ctrl.register)
router.post('/login',           authLimiter, v.login,           validate, ctrl.login)
router.post('/refresh',         ctrl.refreshToken)
router.post('/logout',          protect, ctrl.logout)
router.get ('/me',              protect, ctrl.getMe)
router.put ('/change-password', protect, v.changePassword, validate, ctrl.changePassword)
router.post('/fcm-token',       protect, ctrl.saveFcmToken)

module.exports = router
