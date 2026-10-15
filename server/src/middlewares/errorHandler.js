export default function errorHandler(err, req, res, next) {
  console.error('错误:', err.message)
  const status = err.status || 500
  const message = err.message || '服务器内部错误'
  res.status(status).json({ code: status, message })
}