# 👑 Qrownd Backend v2

Node.js + Express + Socket.io + MongoDB + Firebase — fully real-time, smart notifications.

---

## 🚀 Quick Start

```bash
npm install
cp .env.example .env   # fill all values (see table below)
npm run dev            # starts on :4000
```

---

## 📋 .env Variables

| Variable | Where to get it |
|----------|----------------|
| `MONGODB_URI` | MongoDB Atlas → Cluster → Connect → Drivers |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | Same command (different value) |
| `FIREBASE_*` | Firebase Console → Project Settings → Service Accounts → Generate New Private Key |
| `CLOUDINARY_*` | cloudinary.com → Dashboard |

---

## 📁 Folder Structure

```
src/
├── core/
│   ├── config/
│   │   ├── db.js               MongoDB connect
│   │   ├── firebase.js         Firebase Admin SDK
│   │   └── cloudinary.js       Cloudinary init
│   ├── middleware/
│   │   ├── auth.middleware.js   protect / optionalAuth / requireAdmin
│   │   ├── error.middleware.js  404 + global error handler
│   │   ├── rateLimiter.middleware.js  (generous, skipped in dev)
│   │   └── validate.middleware.js
│   ├── sockets/
│   │   ├── index.js            Socket.io bootstrap + JWT auth
│   │   ├── presence.socket.js  Online/offline map
│   │   ├── chat.socket.js      1-to-1 real-time chat
│   │   └── arena.socket.js     Arena countdown / timer / winner
│   └── utils/
│       ├── apiResponse.js      Standardised JSON helpers
│       ├── jwt.js              sign / verify helpers
│       ├── logger.js           Winston
│       └── notifier.js         ★ SMART NOTIFICATION ENGINE
├── models/
│   ├── User.model.js
│   ├── Post.model.js           (embedded answers)
│   ├── Message.model.js        1-to-1 chat
│   ├── ArenaChallenge.model.js (admin-posted)
│   ├── ArenaRoom.model.js
│   └── Notification.model.js
├── modules/
│   ├── auth/          service · controller · routes · validation
│   ├── users/         service · controller · routes
│   ├── posts/         service · controller · routes · validation
│   ├── chat/          service · controller · routes
│   ├── arena/         service · controller · routes · validation
│   └── notifications/ service · controller · routes
├── routes/index.js    Master router
├── app.js             Express setup
└── server.js          HTTP + Socket.io entry point
```

---

## 📡 API Reference

### Auth `/api/auth`
```
POST /register        body: { name, handle, email, password, interests?, skills? }
POST /login           body: { email, password, fcmToken? }
POST /refresh         (uses refreshToken cookie or body.refreshToken)
POST /logout          🔒
GET  /me              🔒
PUT  /change-password 🔒 body: { currentPassword, newPassword }
POST /fcm-token       🔒 body: { fcmToken }   ← save device token for push
```

### Posts `/api/posts`
```
GET    /                     ?page, limit, category, filter(unsolved|solved|hot|urgent), search
POST   /                     🔒 body: { category, title, description, detail?, tags?, urgency?, anonymous? }
GET    /:id
DELETE /:id                  🔒 (owner only)
POST   /:id/upvote           🔒
POST   /:id/answers          🔒 body: { text }
POST   /:id/answers/:aId/accept  🔒 (post owner only → awards XP + notifies solver)
POST   /:id/answers/:aId/upvote  🔒
```

### Users `/api/users`
```
GET    /leaderboard          ?page, limit
GET    /bookmarks            🔒
PUT    /me                   🔒 body: { name?, bio?, skills?, interests?, color? }
POST   /me/avatar            🔒 multipart/form-data avatar file
POST   /bookmarks/:postId    🔒
DELETE /bookmarks/:postId    🔒
GET    /:handle
GET    /:handle/posts        ?page, limit
```

### Chat `/api/chat`
```
GET    /inbox           🔒  (only users you've chatted with)
GET    /unread          🔒  { unread: number }
GET    /:userId         🔒  ?page, limit  (conversation messages)
```

### Arena `/api/arena`
```
GET    /challenges            ?page, limit, category, difficulty
POST   /challenges            🔒 ADMIN ONLY body: { title, description, category, difficulty, xp, timeLimit }
DELETE /challenges/:id        🔒 ADMIN ONLY
GET    /rooms
POST   /rooms                 🔒 body: { challengeId, name?, maxPlayers?, isPrivate? }
POST   /rooms/:id/join        🔒
POST   /rooms/:id/start       🔒 (host only → triggers socket countdown)
POST   /rooms/:id/submit      🔒 body: { answer }
```

### Notifications `/api/notifications`
```
GET  /              🔒  paginated
PUT  /read-all      🔒
PUT  /:id/read      🔒
```

---

## ⚡ Socket.io Events

Connect: `io(URL, { auth: { token: accessToken } })`

### Presence
| Direction | Event | Payload |
|-----------|-------|---------|
| server→all | `presence:list` | `{ onlineIds: string[] }` |
| server→all | `presence:online` | `{ userId }` |
| server→all | `presence:offline` | `{ userId }` |

### Chat
| Direction | Event | Payload |
|-----------|-------|---------|
| client→server | `chat:send` | `{ toUserId, text }` |
| server→client | `chat:message` | `{ _id, from, to, text, createdAt }` |
| server→client | `chat:sent` | `{ tempId, message }` (ack to sender) |
| client→server | `chat:typing` | `{ toUserId, isTyping }` |
| server→client | `chat:typing` | `{ fromUserId, isTyping }` |
| client→server | `chat:markRead` | `{ fromUserId }` |
| server→client | `chat:read` | `{ byUserId }` |
| server→client | `chat:error` | `{ message }` |

### Posts (real-time feed)
| Direction | Event | Payload |
|-----------|-------|---------|
| server→all | `post:new` | `{ post }` — new post broadcast |
| server→room | `post:newAnswer` | `{ postId, answer }` |
| server→room | `post:answerAccepted` | `{ postId, answerId, solved }` |

### Arena
| Direction | Event | Payload |
|-----------|-------|---------|
| client→server | `arena:joinRoom` | `{ roomId }` |
| client→server | `arena:leaveRoom` | `{ roomId }` |
| client→server | `arena:start` | `{ roomId }` (host) |
| client→server | `arena:submit` | `{ roomId, answer }` |
| client→server | `arena:getRoom` | `{ roomId }` |
| server→all | `arena:roomCreated` | `{ room }` |
| server→room | `room:playerJoined` | `{ user }` |
| server→room | `room:playerOnline` | `{ userId, name, ... }` |
| server→room | `room:playerLeft` | `{ userId, name }` |
| server→room | `room:starting` | `{ challenge, players }` |
| server→room | `room:countdown` | `{ remaining }` |
| server→room | `room:live` | `{ startedAt }` |
| server→room | `room:tick` | `{ remaining }` |
| server→room | `room:playerDone` | `{ userId, name, xpEarned, elapsed }` |
| server→room | `room:winner` | `{ winner, xpAwarded, elapsed }` |
| server→room | `room:expired` | `{ roomId, message }` |
| server→client | `arena:submitAck` | `{ isFirst, xpEarned, elapsed }` |
| server→client | `arena:roomState` | `{ room }` |
| server→client | `arena:error` | `{ message }` |

### Notifications (in-app)
| Direction | Event | Payload |
|-----------|-------|---------|
| server→client | `notification` | `{ _id, type, message, link, data, read, createdAt }` |

---

## 🔔 Notification Logic

| Action | Who gets notified | How |
|--------|-------------------|-----|
| New post created | All **online** users except poster | Socket `notification` event |
| Answer posted | Post author | Socket if online, FCM if offline |
| Answer accepted | Answer author (+XP) | Socket if online, FCM if offline |
| Post upvoted | Post author | Socket if online, FCM if offline |
| Answer upvoted | Answer author | Socket if online, FCM if offline |
| Arena match started | All room players | Socket + FCM |
| Arena win | Winner | Socket if online, FCM if offline |
| Rank improved | User | Socket if online, FCM if offline |
| Chat message | Recipient | Socket if online, FCM if offline |

---

## 🛠️ Make a User Admin

In MongoDB Atlas / Compass:
```js
db.users.updateOne({ handle: "@yourhandle" }, { $set: { isAdmin: true } })
```
Admins can create/delete Arena Challenges.

---

## 📝 Post a post:join event from frontend

When the frontend opens a post detail page, emit this so real-time answer updates work:
```js
socket.emit('post:join', { postId })   // frontend should emit this
```
Backend handles this by putting the socket in `room post:<postId>` — this is already wired in the socket auth flow. Just make sure the frontend emits it.

Actually the socket room join for posts happens automatically when `addAnswer` broadcasts to `post:${postId}` — but for the frontend to receive it, the socket needs to be in that room.

Add this to your frontend PostPage.jsx (already done in the frontend):
```js
socket.emit('post:join', { postId: id })
```

And add this one-liner to `arena.socket.js` in the arenaHandler:
```js
socket.on('post:join', ({ postId }) => { if (postId) socket.join(`post:${postId}`) })
```

This is already included in the arena.socket.js — the `arena:joinRoom` handler joins `room:${roomId}` and the post handler joins `post:${postId}`.
