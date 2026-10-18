import bcrypt from 'bcryptjs'
import { Op } from 'sequelize'
import { User } from '../models/index.js'
import { generateToken } from '../middlewares/auth.js'
import { success, fail } from '../utils/response.js'
import { sendVerificationCode, verifyCode } from '../services/emailService.js'

const emailRegex = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/
const campusOptions = ['一期', '二期', '东校区']

export async function login(req, res, next) {
  try {
    const { email, password } = req.body
    if (!email || !password) return fail(res, '请输入账号和密码')

    const isNo = /^\d{8}$/.test(email)
    const where = isNo ? { userNo: email } : { email }
    const user = await User.findOne({ where })
    if (!user) return fail(res, isNo ? '该ID不存在' : '该邮箱未注册')

    if (user.status === 'banned') {
      return fail(res, '该账号已被封禁，请联系管理员')
    }

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
    if (!emailRegex.test(email)) return fail(res, '邮箱格式不正确')

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
    if (!emailRegex.test(email)) return fail(res, '邮箱格式不正确')
    if (!campus || !campusOptions.includes(campus)) {
      return fail(res, '请选择正确的所属校区')
    }
    if (password.length < 6) return fail(res, '密码至少6位')

    const exists = await User.findOne({ where: { email } })
    if (exists) return fail(res, '该邮箱已注册')

    const codeValid = verifyCode(email, code)
    if (!codeValid) return fail(res, '验证码错误或已过期')

    const hashed = await bcrypt.hash(password, 10)
    const userNo = await nextUserNo()
    const user = await User.create({ email, nickname, realName, password: hashed, campus, userNo })
    const token = generateToken(user)
    const { password: _, ...userInfo } = user.toJSON()
    success(res, { token, user: userInfo }, '注册成功')
  } catch (err) { next(err) }
}

export async function nextUserNo() {
  const last = await User.findOne({
    where: { userNo: { [Op.ne]: '' } },
    order: [['user_no', 'DESC']]
  })
  if (!last || !last.userNo) return '00000001'
  const num = parseInt(last.userNo, 10)
  if (isNaN(num)) return '00000001'
  return String(num + 1).padStart(8, '0')
}

export async function sendResetCode(req, res, next) {
  try {
    const { email } = req.body
    if (!email) return fail(res, '请输入邮箱地址')
    if (!emailRegex.test(email)) return fail(res, '邮箱格式不正确')

    const user = await User.findOne({ where: { email } })
    if (!user) return fail(res, '该邮箱未注册')

    await sendVerificationCode(email)
    success(res, null, '验证码已发送至邮箱')
  } catch (err) { next(err) }
}

export async function resetPassword(req, res, next) {
  try {
    const { email, code, password } = req.body
    if (!email || !code || !password) return fail(res, '请填写邮箱、验证码和新密码')
    if (!emailRegex.test(email)) return fail(res, '邮箱格式不正确')
    if (password.length < 6) return fail(res, '密码至少6位')

    const user = await User.findOne({ where: { email } })
    if (!user) return fail(res, '该邮箱未注册')

    const codeValid = verifyCode(email, code)
    if (!codeValid) return fail(res, '验证码错误或已过期')

    const hashed = await bcrypt.hash(password, 10)
    await User.update({ password: hashed }, { where: { id: user.id } })
    success(res, null, '密码重置成功，请使用新密码登录')
  } catch (err) { next(err) }
}

export async function sendChangeEmailCode(req, res, next) {
  try {
    const { email } = req.body
    if (!email) return fail(res, '请输入新邮箱地址')
    if (!emailRegex.test(email)) return fail(res, '邮箱格式不正确')

    const exists = await User.findOne({
      where: { email, id: { [Op.ne]: req.user.id } }
    })
    if (exists) return fail(res, '该邮箱已被其他账号使用')

    await sendVerificationCode(email)
    success(res, null, '验证码已发送')
  } catch (err) { next(err) }
}

export async function changeEmail(req, res, next) {
  try {
    const { email, code } = req.body
    if (!email || !code) return fail(res, '请输入新邮箱和验证码')
    if (!emailRegex.test(email)) return fail(res, '邮箱格式不正确')

    const exists = await User.findOne({
      where: { email, id: { [Op.ne]: req.user.id } }
    })
    if (exists) return fail(res, '该邮箱已被其他账号使用')

    const codeValid = verifyCode(email, code)
    if (!codeValid) return fail(res, '验证码错误或已过期')

    await User.update({ email }, { where: { id: req.user.id } })
    const user = await User.findByPk(req.user.id)
    const { password: _, ...userInfo } = user.toJSON()
    success(res, { user: userInfo }, '邮箱修改成功')
  } catch (err) { next(err) }
}
export async function me(req, res, next) {
  try {
    const user = await User.findByPk(req.user.id)
    if (!user) return fail(res, '用户不存在', 404)
    const { password: _, ...userInfo } = user.toJSON()
    success(res, { user: userInfo })
  } catch (err) { next(err) }
}