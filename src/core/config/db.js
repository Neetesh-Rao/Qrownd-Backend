const mongoose = require('mongoose')
const logger   = require('../utils/logger')

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGODB_URI)
  logger.info(`MongoDB → ${conn.connection.host}`)
  mongoose.connection.on('error',        e  => logger.error(`MongoDB: ${e.message}`))
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'))
}

module.exports = connectDB
