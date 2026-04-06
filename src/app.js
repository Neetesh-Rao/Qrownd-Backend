require('dotenv').config()

const express       = require('express')
const cors          = require('cors')
const helmet        = require('helmet')
const morgan        = require('morgan')
const compression   = require('compression')
const cookieParser  = require('cookie-parser')
const mongoSanitize = require('express-mongo-sanitize')
const hpp           = require('hpp')

const routes       = require('./routes/index')
const { apiLimiter } = require('./core/middleware/rateLimiter.middleware')
const { notFoundHandler, globalErrorHandler } = require('./core/middleware/error.middleware')
const logger       = require('./core/utils/logger')

const app = express()

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy:     false,
}))

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:     'https://qrownd-frontend.vercel.app',
  credentials: true,
  methods:     ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}))

// ── Compression + body parsers ────────────────────────────────────────────────
app.use(compression())
app.use(express.json({ limit:'10kb' }))
app.use(express.urlencoded({ extended:true, limit:'10kb' }))
app.use(cookieParser())

// ── Sanitise ──────────────────────────────────────────────────────────────────
app.use(mongoSanitize())
app.use(hpp())

// ── Logger (dev only) ─────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}

// ── Rate limit (generous — skipped in dev) ────────────────────────────────────
app.use('/api', apiLimiter)

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', routes)
app.get('/', (_,res) => res.json({ message:'👑 Qrownd API v2', docs:'/api/health' }))

// ── Error handlers (must be last) ────────────────────────────────────────────
app.use(notFoundHandler)
app.use(globalErrorHandler)

module.exports = app
