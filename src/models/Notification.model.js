const mongoose = require('mongoose')
const s = new mongoose.Schema({
  recipient: { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  type:      { type:String, required:true, enum:['answer','upvote','accept','game_start','game_win','message','rank_up','new_post','system'] },
  message:   { type:String, required:true },
  data:      { type:mongoose.Schema.Types.Mixed, default:{} },
  read:      { type:Boolean, default:false },
  link:      { type:String,  default:null },
}, { timestamps:true })
s.index({ recipient:1, read:1, createdAt:-1 })
module.exports = mongoose.model('Notification', s)
