const { createLogger, format, transports } = require('winston')
const path = require('path')
const fs   = require('fs')

const logDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })

const { combine, timestamp, printf, colorize, errors } = format

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? format.json()
      : combine(colorize(), printf(({ level, message, timestamp: ts, stack }) => `${ts} [${level}]: ${stack || message}`))
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: path.join(logDir, 'error.log'),    level:'error', maxsize:5_000_000, maxFiles:3 }),
    new transports.File({ filename: path.join(logDir, 'combined.log'),               maxsize:5_000_000, maxFiles:3 }),
  ],
})

module.exports = logger
