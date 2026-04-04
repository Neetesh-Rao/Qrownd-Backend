const admin  = require('firebase-admin')
const logger = require('../utils/logger')

let ready = false

const initFirebase = () => {
  if (ready || admin.apps.length > 0) return admin
  if (!process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID === 'your-project-id') {
    logger.warn('Firebase not configured – push notifications disabled')
    return null
  }
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        type:          'service_account',
        project_id:    process.env.FIREBASE_PROJECT_ID,
        private_key_id:process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key:   process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email:  process.env.FIREBASE_CLIENT_EMAIL,
        client_id:     process.env.FIREBASE_CLIENT_ID,
        auth_uri:      'https://accounts.google.com/o/oauth2/auth',
        token_uri:     'https://oauth2.googleapis.com/token',
      }),
    })
    ready = true
    logger.info('Firebase Admin SDK ready')
    return admin
  } catch (err) {
    logger.error(`Firebase init failed: ${err.message}`)
    return null
  }
}

module.exports = initFirebase
