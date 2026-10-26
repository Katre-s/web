import jwt from 'jsonwebtoken'
import { User } from '../models/index.js'

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, nickname: user.nickname, role: user.role || 'user', campus: user.campus || '' },
    process.env.JWT_SECRET || 'wenheng_secret',
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  )
}

/**
 * 校验登录态。
 * 以前只验签、不查库，结果是：封禁或注销后，对方手里的 token 还能继续用满 7 天。
 * 这里补一次主键查询（走主键索引，很轻），让封禁/注销立即生效。
 */
export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录或登录已过期' })
  }
  const token = authHeader.substring(7)
  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'wenheng_secret')
  } catch {
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' })
  }

  try {
    const user = await User.findByPk(decoded.id, { attributes: ['id', 'status', 'role'] })
    if (!user) {
      return res.status(401).json({ code: 401, message: '账号不存在' })
    }
    if (user.status === 'banned') {
      return res.status(403).json({ code: 403, message: '该账号已被封禁，请联系管理员' })
    }
    if (user.status === 'cancelled') {
      return res.status(403).json({ code: 403, message: '该账号已注销，请重新注册' })
    }
    // role 以库里为准，避免把管理员降权后旧 token 还带着 admin
    req.user = { ...decoded, role: user.role || decoded.role }
    next()
  } catch (err) {
    next(err)
  }
}
