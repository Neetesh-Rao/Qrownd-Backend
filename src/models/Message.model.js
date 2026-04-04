const mongoose = require('mongoose')
const s = new mongoose.Schema({
  from: { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  to:   { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  text: { type:String, required:true, trim:true, maxlength:2000 },
  read: { type:Boolean, default:false },
}, { timestamps:true })
s.index({ from:1, to:1, createdAt:-1 })
s.index({ to:1, read:1 })
module.exports = mongoose.model('Message', s)
