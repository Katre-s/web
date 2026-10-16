import bcrypt from 'bcryptjs'
import { User } from '../models/index.js'
import { generateToken } from '../middlewares/auth.js'
import { success, fail } from '../utils/response.js'
import { sendVerificationCode, verifyCode } from '../services/emailService.js'

export async function login(req, res, next) {
  try {
    const { email, password } = req.body
    if (!email || !password) return fail(res, '请输入邮箱和密码')

    const user = await User.findOne({ where: { email } })
    if (!user) return fail(res, '该邮箱未注册')

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return fail(res, '密码错误')

    const token = generateToken(user)
    const { password: _, ...userInfo } = user.toJSON()
    success(res, { token, user: userInfo }, '登录成功')
  } catch (err) { next(err) }
}

export async function sendCode(req, res, next) {
  try {
    const { email } = req.body
    if (!email) return fail(res, '请输入邮箱地址')

    const exists = await User.findOne({ where: { email } })
    if (exists) return fail(res, '该邮箱已注册')

    await sendVerificationCode(email)
    success(res, null, '验证码已发送')
  } catch (err) { next(err) }
}

export async function register(req, res, next) {
  try {
    const { nickname, realName, email, code, password, campus } = req.body
    if (!nickname || !realName || !email || !code || !password) {
      return fail(res, '请填写完整信息')
    }

    const exists = await User.findOne({ where: { email } })
    if (exists) return fail(res, '该邮箱已注册')

    const codeValid = verifyCode(email, code)
    if (!codeValid) return fail(res, '验证码错误或已过期')

    const hashed = await bcrypt.hash(password, 10)
    const user = await User.create({ email, nickname, realName, password: hashed, campus: campus || '' })
    const token = generateToken(user)
    const { password: _, ...userInfo } = user.toJSON()
    success(res, { token, user: userInfo }, '注册成功')
  } catch (err) { next(err) }
}