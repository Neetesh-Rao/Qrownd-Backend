require('dotenv').config()

const http             = require('http')
const app              = require('./app')
const connectDB        = require('./core/config/db')
const initFirebase     = require('./core/config/firebase')
const { initCloudinary } = require('./core/config/cloudinary')
const { initSockets }  = require('./core/sockets/index')
const logger           = require('./core/utils/logger')
const dns=require('dns')
const cors = require('cors')
app.use(cors());
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const PORT = process.env.PORT || 4000

const start = async () => {
  // 1. Database
  await connectDB()

  // 2. Firebase (push notifications)
  initFirebase()

  // 3. Cloudinary (avatar uploads)
  initCloudinary()

  // 4. HTTP server
  const httpServer = http.createServer(app)

  // 5. Socket.io — MUST come before httpServer.listen
  const io = initSockets(httpServer)

  // 6. Make io available to controllers via req.app.get('io')
  app.set('io', io)

  // 7. Start
  httpServer.listen(PORT, () => {
    logger.info(`
╔══════════════════════════════════════════╗
║  👑  QROWND BACKEND v2  STARTED          ║
║  Port  : ${PORT}                             ║
║  Env   : ${(process.env.NODE_ENV || 'development').padEnd(12)}            ║
║  API   : http://localhost:${PORT}/api        ║
║  Socket: ws://localhost:${PORT}              ║
╚══════════════════════════════════════════╝
    `)
  })

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = (sig) => {
    logger.info(`${sig} received – shutting down`)
    httpServer.close(() => { logger.info('HTTP closed'); process.exit(0) })
    setTimeout(() => process.exit(1), 10_000)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))

  process.on('unhandledRejection', (r) => logger.error(`UnhandledRejection: ${r}`))
  process.on('uncaughtException',  (e) => { logger.error(`UncaughtException: ${e.message}`); process.exit(1) })
}

start()
