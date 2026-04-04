const User       = require('../../models/User.model')
const Post       = require('../../models/Post.model')
const { cloudinary } = require('../../core/config/cloudinary')
const logger     = require('../../core/utils/logger')

const _err = (m,s=400) => { const e=new Error(m); e.status=s; return e }

const getProfile = async (handle) => {
  const u = await User.findOne({ handle, isActive:true })
  if (!u) throw _err('User not found', 404)
  return u.toPublic()
}

const updateProfile = async (userId, body) => {
  const ok = ['name','bio','skills','interests','color']
  const p  = {}
  ok.forEach(f => { if (body[f]!==undefined) p[f]=body[f] })
  if (p.name) p.initials = p.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)
  const u = await User.findByIdAndUpdate(userId, p, { new:true, runValidators:true })
  return u.toPublic()
}

const uploadAvatar = async (userId, buf, mime) => {
  const b64    = `data:${mime};base64,${buf.toString('base64')}`
  const result = await cloudinary.uploader.upload(b64, {
    folder:'qrownd/avatars', public_id:`user_${userId}`, overwrite:true,
    transformation:[{width:200,height:200,crop:'fill',gravity:'face'}],
  })
  const u = await User.findByIdAndUpdate(userId, { avatar:result.secure_url }, { new:true })
  return u.toPublic()
}

const getLeaderboard = async (page=1, limit=20) => {
  const skip = (page-1)*limit
  const [users, total] = await Promise.all([
    User.find({ isActive:true }).sort({ xp:-1 }).skip(skip).limit(limit)
      .select('name handle initials color xp level totalSolved arenaWins streak'),
    User.countDocuments({ isActive:true }),
  ])
  return { users: users.map((u,i) => ({ rank:skip+i+1, ...u.toObject() })), total }
}

const addBookmark    = (uid,pid) => User.findByIdAndUpdate(uid, { $addToSet:{bookmarks:pid} })
const removeBookmark = (uid,pid) => User.findByIdAndUpdate(uid, { $pull:{bookmarks:pid} })
const getBookmarks   = async (uid) => {
  const u = await User.findById(uid).populate({ path:'bookmarks', match:{isDeleted:false}, select:'title category description votes answers solved urgency xp createdAt', options:{sort:{createdAt:-1}} })
  return u?.bookmarks || []
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

const recomputeRanks = async () => {
  const users = await User.find({ isActive:true }).sort({xp:-1}).select('_id')
  const ops   = users.map((u,i) => ({ updateOne:{ filter:{_id:u._id}, update:{rank:i+1} } }))
  if (ops.length) await User.bulkWrite(ops)
  logger.info(`Ranks recomputed for ${ops.length} users`)
}

module.exports = { getProfile, updateProfile, uploadAvatar, getLeaderboard, addBookmark, removeBookmark, getBookmarks, getUserPosts, recomputeRanks }
