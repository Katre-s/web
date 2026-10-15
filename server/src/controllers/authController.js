import bcrypt from 'bcryptjs'
import { User } from '../models/index.js'
import { generateToken } from '../middlewares/auth.js'
import { success, fail } from '../utils/response.js'

export async function login(req, res, next) {
  try {
    const { studentId, password } = req.body
    if (!studentId || !password) return fail(res, '请输入学号和密码')

    const user = await User.findOne({ where: { studentId } })
    if (!user) return fail(res, '用户不存在')

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return fail(res, '密码错误')

    const token = generateToken(user)
    const { password: _, ...userInfo } = user.toJSON()
    success(res, { token, user: userInfo }, '登录成功')
  } catch (err) { next(err) }
}

export async function register(req, res, next) {
  try {
    const { studentId, password, nickname } = req.body
    if (!studentId || !password || !nickname) return fail(res, '请填写完整信息')

    const exists = await User.findOne({ where: { studentId } })
    if (exists) return fail(res, '该学号已注册')

    const hashed = await bcrypt.hash(password, 10)
    const user = await User.create({ studentId, password: hashed, nickname })
    const token = generateToken(user)
    const { password: _, ...userInfo } = user.toJSON()
    success(res, { token, user: userInfo }, '注册成功')
  } catch (err) { next(err) }
}