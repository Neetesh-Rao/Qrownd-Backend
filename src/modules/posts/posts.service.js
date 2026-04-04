/**
 * posts.service.js
 *
 * All post/answer operations.
 * Real-time:
 *  – New post   → broadcast to ALL online users via socket  (post:new event)
 *  – New answer → socket push to post author  +  notify()
 *  – Accept     → socket push to answer author + notify()
 *  – Upvote     → notify() post/answer author
 */

const Post         = require('../../models/Post.model')
const User         = require('../../models/User.model')
const { notify, notifyNewPost } = require('../../core/utils/notifier')
const { getIO, onlineMap }      = require('../../core/sockets/index')
const logger       = require('../../core/utils/logger')

const _err = (m,s=400) => { const e=new Error(m); e.status=s; return e }

// ── Create post ───────────────────────────────────────────────────────────────
const createPost = async (userId, data) => {
  const user = await User.findById(userId)
  if (!user) throw _err('User not found', 404)

  const xp   = Post.xpForUrgency(data.urgency)
  const anon = data.anonymous === true

  const post = await Post.create({
    author: {
      _id:      user._id,
      name:     anon ? 'Anonymous' : user.name,
      handle:   anon ? '@anon'     : user.handle,
      initials: anon ? '?'         : user.initials,
      color:    anon ? 'linear-gradient(135deg,#7b7c8d,#2a2b3d)' : user.color,
    },
    anonymous:   anon,
    category:    data.category,
    title:       data.title.trim(),
    description: data.description.trim(),
    detail:      data.detail?.trim() || '',
    tags:        data.tags   || [],
    urgency:     data.urgency || 'medium',
    xp,
  })

  user.totalPosted += 1
  user.addXP(10)
  await user.save({ validateBeforeSave:false })

  // ── Real-time: push new post to all online users (except poster) ──────────
  const io = getIO()
  if (io) {
    // Emit post:new to all connected sockets
    io.emit('post:new', {
      post: {
        ...post.toObject(),
        answerCount: 0,
        upvoted:     false,
        upvotedBy:   undefined,
        answers:     undefined,
      },
    })
  }

  // Smart notification to all online users
  if (!anon) {
    await notifyNewPost({
      postId:      post._id.toString(),
      postTitle:   post.title,
      posterName:  user.name,
      excludeId:   userId,
      io,
      onlineMap,
    })
  }

  logger.info(`Post created [${post._id}] by ${user.handle}`)
  return post
}

// ── Get posts ─────────────────────────────────────────────────────────────────
const getPosts = async ({ page=1, limit=20, category, filter, search, userId }={}) => {
  const skip  = (page-1)*limit
  const query = { isDeleted:false }

  if (category)           query.category = category
  if (filter==='unsolved') query.solved   = false
  if (filter==='solved')   query.solved   = true
  if (filter==='hot')      query.votes    = { $gte:10 }
  if (filter==='urgent') { query.urgency  = 'high'; query.solved=false }
  if (search)              query.$text    = { $search:search }

  const [posts, total] = await Promise.all([
    Post.find(query).sort({createdAt:-1}).skip(skip).limit(limit).lean(),
    Post.countDocuments(query),
  ])

  const enriched = posts.map(p => ({
    ...p,
    upvoted:     userId ? p.upvotedBy?.some(id=>id.toString()===userId.toString()) : false,
    answerCount: p.answers?.length || 0,
    upvotedBy:   undefined,
    answers:     undefined,
  }))
  return { posts:enriched, total }
}

// ── Get single post ───────────────────────────────────────────────────────────
const getPostById = async (postId, userId) => {
  const post = await Post.findOne({ _id:postId, isDeleted:false })
  if (!post) throw _err('Post not found', 404)

  Post.findByIdAndUpdate(postId, { $inc:{ views:1 } }).exec()

  const obj     = post.toObject()
  obj.upvoted   = userId ? post.upvotedBy.some(id=>id.toString()===userId.toString()) : false
  obj.upvotedBy = undefined
  obj.answers   = obj.answers.map(a => ({
    ...a,
    upvoted:   userId ? a.upvotedBy?.some(id=>id.toString()===userId.toString()) : false,
    upvotedBy: undefined,
  }))
  return obj
}

// ── Upvote post ───────────────────────────────────────────────────────────────
const upvotePost = async (postId, userId) => {
  const post = await Post.findOne({ _id:postId, isDeleted:false })
  if (!post) throw _err('Post not found', 404)

  const already = post.upvotedBy.some(id=>id.toString()===userId.toString())
  if (already) { post.votes--; post.upvotedBy.pull(userId) }
  else {
    post.votes++; post.upvotedBy.push(userId)
    if (!post.anonymous && post.author._id.toString()!==userId.toString()) {
      const voter = await User.findById(userId).select('name fcmToken')
      if (voter) {
        await notify({
          recipientId: post.author._id,
          type:        'upvote',
          message:     `${voter.name} upvoted your post: "${post.title.slice(0,50)}"`,
          link:        `/post/${postId}`,
          data:        { postId },
          io:          getIO(),
          onlineMap,
          fcmToken:    await _getFcmToken(post.author._id),
        })
      }
    }
  }
  await post.save({ validateBeforeSave:false })
  return { votes:post.votes, upvoted:!already }
}

// ── Add answer ────────────────────────────────────────────────────────────────
const addAnswer = async (postId, userId, text) => {
  const [post, user] = await Promise.all([
    Post.findOne({ _id:postId, isDeleted:false }),
    User.findById(userId),
  ])
  if (!post) throw _err('Post not found', 404)
  if (!user) throw _err('User not found', 404)
  if (post.solved) throw _err('Post already solved', 400)

  post.answers.push({
    author: { _id:user._id, name:user.name, handle:user.handle, initials:user.initials, color:user.color },
    text, votes:0, accepted:false,
  })
  await post.save({ validateBeforeSave:false })

  const newAnswer = post.answers[post.answers.length-1]

  user.totalAnswers += 1
  user.addXP(20)
  await user.save({ validateBeforeSave:false })

  const io = getIO()

  // ── Real-time: push new answer to everyone viewing this post ──────────────
  if (io) {
    io.to(`post:${postId}`).emit('post:newAnswer', {
      postId,
      answer: {
        ...newAnswer.toObject(),
        upvoted:   false,
        upvotedBy: undefined,
      },
    })
  }

  // ── Notify post author ────────────────────────────────────────────────────
  if (!post.anonymous && post.author._id.toString()!==userId.toString()) {
    await notify({
      recipientId: post.author._id,
      type:        'answer',
      message:     `${user.name} answered your problem: "${post.title.slice(0,50)}"`,
      link:        `/post/${postId}`,
      data:        { postId, answerId:newAnswer._id },
      io,
      onlineMap,
      fcmToken:    await _getFcmToken(post.author._id),
    })
  }

  logger.info(`Answer [${newAnswer._id}] on post [${postId}]`)
  return newAnswer
}

// ── Accept answer ─────────────────────────────────────────────────────────────
const acceptAnswer = async (postId, answerId, requesterId) => {
  const post = await Post.findOne({ _id:postId, isDeleted:false })
  if (!post)   throw _err('Post not found', 404)
  if (post.author._id.toString()!==requesterId.toString()) throw _err('Only post author can accept', 403)

  const answer = post.answers.id(answerId)
  if (!answer) throw _err('Answer not found', 404)

  post.answers.forEach(a => { a.accepted=false })
  answer.accepted = true
  post.solved     = true
  await post.save({ validateBeforeSave:false })

  const io = getIO()

  // ── Real-time: update all viewers ─────────────────────────────────────────
  if (io) {
    io.to(`post:${postId}`).emit('post:answerAccepted', { postId, answerId, solved:true })
  }

  // ── Award XP + notify solver ──────────────────────────────────────────────
  const solver = await User.findById(answer.author._id).select('+fcmToken')
  if (solver) {
    solver.totalSolved += 1
    solver.addXP(post.xp)
    await solver.save({ validateBeforeSave:false })

    await notify({
      recipientId: solver._id,
      type:        'accept',
      message:     `Your answer was accepted on "${post.title.slice(0,50)}" — +${post.xp} XP! 🎉`,
      link:        `/post/${postId}`,
      data:        { postId, xpEarned:post.xp },
      io,
      onlineMap,
      fcmToken:    solver.fcmToken,
    })

    // Check rank-up after XP gain
    await _checkRankUp(solver, io)
  }

  logger.info(`Answer [${answerId}] accepted on post [${postId}]`)
  return { postId, answerId, xpAwarded:post.xp }
}

// ── Upvote answer ─────────────────────────────────────────────────────────────
const upvoteAnswer = async (postId, answerId, userId) => {
  const post   = await Post.findOne({ _id:postId, isDeleted:false })
  if (!post)   throw _err('Post not found', 404)
  const answer = post.answers.id(answerId)
  if (!answer) throw _err('Answer not found', 404)

  const already = answer.upvotedBy.some(id=>id.toString()===userId.toString())
  if (already) { answer.votes--; answer.upvotedBy.pull(userId) }
  else {
    answer.votes++; answer.upvotedBy.push(userId)
    if (answer.author._id.toString()!==userId.toString()) {
      const voter = await User.findById(userId).select('name')
      if (voter) {
        await notify({
          recipientId: answer.author._id,
          type:        'upvote',
          message:     `${voter.name} upvoted your answer`,
          link:        `/post/${postId}`,
          data:        { postId, answerId },
          io:          getIO(),
          onlineMap,
          fcmToken:    await _getFcmToken(answer.author._id),
        })
      }
    }
  }
  await post.save({ validateBeforeSave:false })
  return { votes:answer.votes, upvoted:!already }
}

// ── Delete (soft) ─────────────────────────────────────────────────────────────
const deletePost = async (postId, requesterId) => {
  const post = await Post.findOne({ _id:postId, isDeleted:false })
  if (!post) throw _err('Post not found', 404)
  if (post.author._id.toString()!==requesterId.toString()) throw _err('Unauthorized', 403)
  post.isDeleted = true
  await post.save({ validateBeforeSave:false })
}

const getUserPosts = async (handle, page=1, limit=10) => {
  const skip  = (page-1)*limit
  const query = { 'author.handle':handle, isDeleted:false, anonymous:false }
  const [posts, total] = await Promise.all([
    Post.find(query).sort({createdAt:-1}).skip(skip).limit(limit).select('-answers -upvotedBy').lean(),
    Post.countDocuments(query),
  ])
  return { posts, total }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const _getFcmToken = async (userId) => {
  const u = await User.findById(userId).select('fcmToken').lean()
  return u?.fcmToken || null
}

const _checkRankUp = async (user, io) => {
  // Compare rank before/after recomputing
  const aboveCount = await User.countDocuments({ xp:{ $gt:user.xp }, isActive:true })
  const newRank    = aboveCount + 1
  if (newRank < user.rank) {
    const oldRank = user.rank
    user.rank = newRank
    await user.save({ validateBeforeSave:false })
    await notify({
      recipientId: user._id,
      type:        'rank_up',
      message:     `🎉 Your rank went up! #${oldRank} → #${newRank}`,
      link:        '/rankings',
      data:        { oldRank, newRank },
      io,
      onlineMap,
      fcmToken:    user.fcmToken,
    })
  }
}

module.exports = { createPost, getPosts, getPostById, upvotePost, addAnswer, acceptAnswer, upvoteAnswer, deletePost, getUserPosts }
