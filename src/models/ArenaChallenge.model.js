const mongoose = require('mongoose')
const s = new mongoose.Schema({
  createdBy:   { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  title:       { type:String, required:true, trim:true, minlength:10, maxlength:200 },
  description: { type:String, trim:true, maxlength:2000, default:'' },
  category:    { type:String, required:true, enum:['tech','study','life','career','health','creative','finance','relation'] },
  difficulty:  { type:String, enum:['easy','medium','hard'], default:'medium' },
  xp:          { type:Number, required:true, min:10, max:500 },
  timeLimit:   { type:Number, required:true, min:30, max:3600, default:300 },
  isActive:    { type:Boolean, default:true },
}, { timestamps:true })
s.index({ category:1, difficulty:1 })
s.index({ isActive:1 })
module.exports = mongoose.model('ArenaChallenge', s)
