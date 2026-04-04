const router   = require('express').Router()
const ctrl     = require('./arena.controller')
const v        = require('./arena.validation')
const validate = require('../../core/middleware/validate.middleware')
const { protect, requireAdmin } = require('../../core/middleware/auth.middleware')

// Challenges — admin manages, public reads
router.get   ('/challenges',           ctrl.getChallenges)
router.post  ('/challenges',           protect, requireAdmin, v.createChallenge, validate, ctrl.createChallenge)
router.delete('/challenges/:id',       protect, requireAdmin,                              ctrl.deleteChallenge)

// Rooms — any logged-in user
router.get   ('/rooms',                ctrl.getRooms)
router.post  ('/rooms',                protect, v.createRoom,   validate, ctrl.createRoom)
router.post  ('/rooms/:id/join',       protect,                           ctrl.joinRoom)
router.post  ('/rooms/:id/start',      protect,                           ctrl.startRoom)
router.post  ('/rooms/:id/submit',     protect, v.submitAnswer, validate, ctrl.submitAnswer)

module.exports = router
