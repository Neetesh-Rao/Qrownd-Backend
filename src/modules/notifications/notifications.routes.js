const router = require('express').Router()
const ctrl   = require('./notifications.controller')
const { protect } = require('../../core/middleware/auth.middleware')
router.use(protect)
router.get ('/',          ctrl.getNotifications)
router.put ('/read-all',  ctrl.markAllRead)
router.put ('/:id/read',  ctrl.markOneRead)
module.exports = router
