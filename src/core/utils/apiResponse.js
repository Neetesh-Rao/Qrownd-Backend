const ts = () => new Date().toISOString()

const success  = (res, data={}, message='Success', code=200) => res.status(code).json({ success:true,  message, data,   timestamp:ts() })
const created  = (res, data={}, message='Created')           => res.status(201).json({ success:true,  message, data,   timestamp:ts() })
const error    = (res, message='Error', code=500, errors=null) => {
  const body = { success:false, message, timestamp:ts() }
  if (errors) body.errors = errors
  return res.status(code).json(body)
}
const notFound     = (res, msg='Not found')         => error(res, msg, 404)
const unauthorized = (res, msg='Unauthorized')       => error(res, msg, 401)
const forbidden    = (res, msg='Forbidden')          => error(res, msg, 403)
const badRequest   = (res, msg='Bad request', errs)  => error(res, msg, 400, errs)
const conflict     = (res, msg='Already exists')     => error(res, msg, 409)
const paginated    = (res, data, page, limit, total, message='Success') =>
  res.status(200).json({
    success:true, message, data,
    pagination:{ page:+page, limit:+limit, total, totalPages:Math.ceil(total/limit), hasMore:+page*+limit<total },
    timestamp:ts(),
  })

module.exports = { success, created, error, notFound, unauthorized, forbidden, badRequest, conflict, paginated }
