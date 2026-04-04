const logger = require('../utils/logger')

const notFoundHandler = (req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`)
  err.status = 404; next(err)
}

const globalErrorHandler = (err, req, res, next) => {
  let { status=500, message } = err
  if (err.name==='ValidationError') { status=400; message=Object.values(err.errors).map(e=>e.message).join(', ') }
  if (err.code===11000)             { status=409; message=`${Object.keys(err.keyValue||{})[0]||'field'} already exists` }
  if (err.name==='CastError')       { status=400; message=`Invalid ${err.path}` }
  if (err.name==='JsonWebTokenError') { status=401; message='Invalid token' }
  if (err.name==='TokenExpiredError') { status=401; message='Token expired' }

  if (status>=500) logger.error(`[${status}] ${req.method} ${req.path} – ${err.stack||err.message}`)
  else             logger.warn( `[${status}] ${req.method} ${req.path} – ${message}`)

  return res.status(status).json({
    success:false,
    message: process.env.NODE_ENV==='production' && status>=500 ? 'Internal server error' : message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV!=='production' && { stack: err.stack }),
  })
}

module.exports = { notFoundHandler, globalErrorHandler }
