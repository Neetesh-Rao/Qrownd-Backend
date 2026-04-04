const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

const userSchema = new mongoose.Schema({
  name:      { type:String, required:true, trim:true, minlength:2, maxlength:60 },
  handle:    { type:String, required:true, unique:true, lowercase:true, trim:true, match:[/^@[a-z0-9_]{2,30}$/,'Invalid handle'] },
  email:     { type:String, required:true, unique:true, lowercase:true, trim:true },
  password:  { type:String, required:true, minlength:6, select:false },
  initials:  { type:String, maxlength:2, default:'' },
  avatar:    { type:String, default:null },
  color:     { type:String, default:'linear-gradient(135deg,#7c5cfc,#e040fb)' },
  fcmToken:  { type:String, default:null, select:false },

  // Gamification
  xp:             { type:Number, default:0, min:0 },
  level:          { type:Number, default:1 },
  rank:           { type:Number, default:9999 },
  streak:         { type:Number, default:0 },
  lastActiveDate: { type:Date,   default:null },

  // Stats
  totalSolved:  { type:Number, default:0 },
  totalPosted:  { type:Number, default:0 },
  totalAnswers: { type:Number, default:0 },
  arenaWins:    { type:Number, default:0 },

  // Profile
  bio:       { type:String, maxlength:200, default:'' },
  interests: [{ type:String }],
  skills:    [{ type:String }],
  badges:    [{ type:String }],
  bookmarks: [{ type:mongoose.Schema.Types.ObjectId, ref:'Post' }],

  refreshTokens: { type:[String], select:false, default:[] },

  isActive:  { type:Boolean, default:true },
  isBanned:  { type:Boolean, default:false },
  isAdmin:   { type:Boolean, default:false },
  isVerified:{ type:Boolean, default:false },
}, { timestamps:true })

userSchema.index({ email:1 })
userSchema.index({ handle:1 })
userSchema.index({ xp:-1 })

userSchema.pre('save', async function(next) {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12)
  if (!this.initials) this.initials = this.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)
  next()
})

userSchema.methods.comparePassword = function(c) { return bcrypt.compare(c, this.password) }

userSchema.methods.addXP = function(n) {
  this.xp   += n
  this.level = Math.floor(this.xp/500)+1
}

userSchema.methods.updateStreak = function() {
  const today = new Date(); today.setHours(0,0,0,0)
  if (!this.lastActiveDate) { this.streak=1 }
  else {
    const last = new Date(this.lastActiveDate); last.setHours(0,0,0,0)
    const diff = Math.round((today-last)/86_400_000)
    if (diff===1) this.streak++; else if (diff>1) this.streak=1
  }
  this.lastActiveDate = new Date()
}

userSchema.methods.toPublic = function() {
  return {
    id:           this._id,
    name:         this.name,
    handle:       this.handle,
    initials:     this.initials,
    avatar:       this.avatar,
    color:        this.color,
    xp:           this.xp,
    level:        this.level,
    rank:         this.rank,
    streak:       this.streak,
    totalSolved:  this.totalSolved,
    totalPosted:  this.totalPosted,
    totalAnswers: this.totalAnswers,
    arenaWins:    this.arenaWins,
    bio:          this.bio,
    interests:    this.interests,
    skills:       this.skills,
    badges:       this.badges,
    isVerified:   this.isVerified,
    isAdmin:      this.isAdmin,
    createdAt:    this.createdAt,
  }
}

module.exports = mongoose.model('User', userSchema)
