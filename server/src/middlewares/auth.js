import jwt from 'jsonwebtoken'

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, nickname: user.nickname, role: user.role || 'user', campus: user.campus || '' },
    process.env.JWT_SECRET || 'wenheng_secret',
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  )
}

export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录或登录已过期' })
  }
  const token = authHeader.substring(7)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'wenheng_secret')
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' })
  }
}