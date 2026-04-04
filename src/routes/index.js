const router = require('express').Router()

router.use('/auth',          require('../modules/auth/auth.routes'))
router.use('/users',         require('../modules/users/users.routes'))
router.use('/posts',         require('../modules/posts/posts.routes'))
router.use('/chat',          require('../modules/chat/chat.routes'))
router.use('/arena',         require('../modules/arena/arena.routes'))
router.use('/notifications', require('../modules/notifications/notifications.routes'))

router.get('/health', (_, res) => res.json({
  success:   true,
  message:   'Qrownd API is running 👑',
  timestamp: new Date().toISOString(),
  version:   '2.0.0',
}))

module.exports = router
