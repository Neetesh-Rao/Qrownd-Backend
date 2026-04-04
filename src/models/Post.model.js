const mongoose = require('mongoose')

const CATS = ['tech','study','life','career','health','creative','finance','relation']

const answerSchema = new mongoose.Schema({
  author: {
    _id:      { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
    name:     String, handle:String, initials:String, color:String,
  },
  text:      { type:String, required:true, trim:true, minlength:10, maxlength:5000 },
  votes:     { type:Number, default:0 },
  upvotedBy: [{ type:mongoose.Schema.Types.ObjectId, ref:'User' }],
  accepted:  { type:Boolean, default:false },
}, { timestamps:true })

const postSchema = new mongoose.Schema({
  author: {
    _id:      { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
    name:     String, handle:String, initials:String, color:String,
  },
  anonymous:   { type:Boolean, default:false },
  category:    { type:String, required:true, enum:CATS },
  title:       { type:String, required:true, trim:true, minlength:10, maxlength:200 },
  description: { type:String, required:true, trim:true, minlength:20, maxlength:500 },
  detail:      { type:String, trim:true, maxlength:5000, default:'' },
  tags:        [{ type:String, lowercase:true, trim:true }],
  urgency:     { type:String, enum:['low','medium','high'], default:'medium' },
  xp:          { type:Number, default:60 },
  votes:       { type:Number, default:0 },
  upvotedBy:   [{ type:mongoose.Schema.Types.ObjectId, ref:'User' }],
  views:       { type:Number, default:0 },
  answers:     [answerSchema],
  solved:      { type:Boolean, default:false },
  isDeleted:   { type:Boolean, default:false },
}, { timestamps:true })

postSchema.index({ category:1, createdAt:-1 })
postSchema.index({ 'author._id':1 })
postSchema.index({ votes:-1 })
postSchema.index({ solved:1 })
postSchema.index({ title:'text', description:'text', detail:'text' })

postSchema.statics.xpForUrgency = (u) => ({ low:30, medium:60, high:100 }[u] ?? 60)

module.exports = mongoose.model('Post', postSchema)
