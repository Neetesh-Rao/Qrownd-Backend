const router = require('express').Router()
const ctrl   = require('./users.controller')
const { protect } = require('../../core/middleware/auth.middleware')
const multer = require('multer')
const upload = multer({ storage:multer.memoryStorage(), limits:{fileSize:5*1024*1024}, fileFilter:(_,f,cb)=>f.mimetype.startsWith('image/')?cb(null,true):cb(new Error('Images only')) })

router.get   ('/leaderboard',          ctrl.getLeaderboard)
router.get   ('/bookmarks',            protect, ctrl.getBookmarks)
router.put   ('/me',                   protect, ctrl.updateProfile)
router.post  ('/me/avatar',            protect, upload.single('avatar'), ctrl.uploadAvatar)
router.post  ('/bookmarks/:postId',    protect, ctrl.addBookmark)
router.delete('/bookmarks/:postId',    protect, ctrl.removeBookmark)
router.get   ('/:handle',              ctrl.getProfile)
router.get   ('/:handle/posts',        ctrl.getUserPosts)

module.exports = router
