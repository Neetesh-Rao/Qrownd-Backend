const { body } = require('express-validator')
const CATS = ['tech','study','life','career','health','creative','finance','relation']
const createPost = [
  body('category').isIn(CATS).withMessage('Invalid category'),
  body('title').trim().isLength({min:10,max:200}).withMessage('Title 10-200 chars'),
  body('description').trim().isLength({min:20,max:500}).withMessage('Description 20-500 chars'),
  body('detail').optional().trim().isLength({max:5000}),
  body('tags').optional().isArray({max:8}).withMessage('Max 8 tags'),
  body('urgency').optional().isIn(['low','medium','high']),
  body('anonymous').optional().isBoolean(),
]
const addAnswer = [
  body('text').trim().isLength({min:10,max:5000}).withMessage('Answer 10-5000 chars'),
]
module.exports = { createPost, addAnswer }
