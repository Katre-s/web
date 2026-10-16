import { verifyToken } from './auth.js'

export function adminOnly(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ code: 403, message: '无管理员权限' })
    }
    next()
  })
}