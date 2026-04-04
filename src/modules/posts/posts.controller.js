const svc = require('./posts.service')
const api = require('../../core/utils/apiResponse')

const createPost  = async (req,res,next) => { try { return api.created(res,{post:await svc.createPost(req.user._id,req.body)},'Problem posted') } catch(e){next(e)} }
const getPosts    = async (req,res,next) => {
  try {
    const { page=1,limit=20,category,filter,search } = req.query
    const r = await svc.getPosts({ page:+page,limit:+limit,category,filter,search,userId:req.user?._id })
    return api.paginated(res,r.posts,page,limit,r.total)
  } catch(e){next(e)}
}
const getPost     = async (req,res,next) => { try { return api.success(res,{post:await svc.getPostById(req.params.id,req.user?._id)}) } catch(e){next(e)} }
const upvotePost  = async (req,res,next) => { try { const r=await svc.upvotePost(req.params.id,req.user._id); return api.success(res,r) } catch(e){next(e)} }
const addAnswer   = async (req,res,next) => { try { return api.created(res,{answer:await svc.addAnswer(req.params.id,req.user._id,req.body.text)},'Answer posted') } catch(e){next(e)} }
const acceptAnswer= async (req,res,next) => { try { return api.success(res,await svc.acceptAnswer(req.params.id,req.params.answerId,req.user._id),'Answer accepted!') } catch(e){next(e)} }
const upvoteAnswer= async (req,res,next) => { try { return api.success(res,await svc.upvoteAnswer(req.params.id,req.params.answerId,req.user._id)) } catch(e){next(e)} }
const deletePost  = async (req,res,next) => { try { await svc.deletePost(req.params.id,req.user._id); return api.success(res,{},'Deleted') } catch(e){next(e)} }

module.exports = { createPost, getPosts, getPost, upvotePost, addAnswer, acceptAnswer, upvoteAnswer, deletePost }
