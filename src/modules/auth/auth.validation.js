const { body } = require('express-validator')
const register = [
  body('name').trim().notEmpty().withMessage('Name required').isLength({min:2,max:60}),
  body('handle').trim().matches(/^@[a-z0-9_]{2,30}$/).withMessage('Handle: @username (lowercase)'),
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({min:6}).withMessage('Password min 6 chars'),
]
const login = [
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password required'),
]
const changePassword = [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword').isLength({min:6}).withMessage('Min 6 chars'),
]
module.exports = { register, login, changePassword }
