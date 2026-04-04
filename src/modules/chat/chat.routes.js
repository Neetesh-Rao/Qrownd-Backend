const router = require('express').Router()
const ctrl   = require('./chat.controller')
const { protect } = require('../../core/middleware/auth.middleware')
router.use(protect)
router.get('/inbox',    ctrl.getInbox)
router.get('/unread',   ctrl.getUnreadCount)
router.get('/:userId',  ctrl.getConversation)
module.exports = router
