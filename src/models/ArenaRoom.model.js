const mongoose = require('mongoose')

const playerSchema = new mongoose.Schema({
  user:       { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  name:       String, handle:String, initials:String, color:String,
  status:     { type:String, enum:['waiting','solving','done','left'], default:'waiting' },
  submitTime: { type:Number, default:null },
  xpEarned:   { type:Number, default:0 },
}, { _id:false })

const s = new mongoose.Schema({
  challenge:  { type:mongoose.Schema.Types.ObjectId, ref:'ArenaChallenge', required:true },
  host:       { type:mongoose.Schema.Types.ObjectId, ref:'User',           required:true },
  name:       { type:String, required:true, trim:true, maxlength:60 },
  isPrivate:  { type:Boolean, default:false },
  maxPlayers: { type:Number,  default:8, min:2, max:20 },
  players:    [playerSchema],
  winner:     { type:mongoose.Schema.Types.ObjectId, ref:'User', default:null },
  status:     { type:String,  enum:['waiting','countdown','live','finished'], default:'waiting' },
  startedAt:  { type:Date,    default:null },
  endedAt:    { type:Date,    default:null },
}, { timestamps:true })

s.index({ status:1, createdAt:-1 })
module.exports = mongoose.model('ArenaRoom', s)
