const rateLimit = require('express-rate-limit')

const make = (max, windowMs) => rateLimit({
  windowMs: windowMs || Number(process.env.RATE_LIMIT_WINDOW_MS) || 900_000,
  max,
  standardHeaders: true,
  legacyHeaders:   false,
  skip: () => process.env.NODE_ENV === 'development',  // skip in dev entirely
  message: { success:false, message:'Too many requests – slow down a bit' },
})

// API: 500 requests per 15 min (very generous)
const apiLimiter = make(Number(process.env.RATE_LIMIT_MAX) || 500)

// Auth: 20 login attempts per 15 min (anti brute-force only)
const authLimiter = make(Number(process.env.AUTH_RATE_LIMIT_MAX) || 20)

module.exports = { apiLimiter, authLimiter }
