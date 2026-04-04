const router   = require('express').Router()
const ctrl     = require('./posts.controller')
const v        = require('./posts.validation')
const validate = require('../../core/middleware/validate.middleware')
const { protect, optionalAuth } = require('../../core/middleware/auth.middleware')

router.get ('/',                              optionalAuth,                ctrl.getPosts)
router.post('/',                              protect, v.createPost, validate, ctrl.createPost)
router.get ('/:id',                           optionalAuth,                ctrl.getPost)
router.delete('/:id',                         protect,                     ctrl.deletePost)
router.post('/:id/upvote',                    protect,                     ctrl.upvotePost)
router.post('/:id/answers',                   protect, v.addAnswer, validate, ctrl.addAnswer)
router.post('/:id/answers/:answerId/accept',  protect,                     ctrl.acceptAnswer)
router.post('/:id/answers/:answerId/upvote',  protect,                     ctrl.upvoteAnswer)

module.exports = router
