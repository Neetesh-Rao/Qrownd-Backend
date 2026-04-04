const { body } = require('express-validator')
const CATS = ['tech','study','life','career','health','creative','finance','relation']

const createChallenge = [
  body('title').trim().isLength({min:10,max:200}).withMessage('Title 10-200 chars'),
  body('description').optional().trim().isLength({max:2000}),
  body('category').isIn(CATS).withMessage('Invalid category'),
  body('difficulty').isIn(['easy','medium','hard']).withMessage('Invalid difficulty'),
  body('xp').isInt({min:10,max:500}).withMessage('XP 10-500'),
  body('timeLimit').isInt({min:30,max:3600}).withMessage('Time limit 30-3600 seconds'),
]
const createRoom = [
  body('challengeId').notEmpty().withMessage('challengeId required'),
  body('name').optional().trim().isLength({max:60}),
  body('maxPlayers').optional().isInt({min:2,max:20}),
  body('isPrivate').optional().isBoolean(),
]
const submitAnswer = [
  body('answer').trim().notEmpty().withMessage('Answer required'),
]

module.exports = { createChallenge, createRoom, submitAnswer }
