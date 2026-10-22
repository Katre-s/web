/**
 * 创建 / 重置管理员账号
 * 用法：
 *   npm run admin:create -- admin@example.com 你的密码
 * 或写入 .env：
 *   ADMIN_EMAIL=admin@example.com
 *   ADMIN_PASSWORD=你的密码
 *   npm run admin:create
 */
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import { sequelize, User } from '../models/index.js'

dotenv.config()

async function main() {
  const email = (process.argv[2] || process.env.ADMIN_EMAIL || '').trim()
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || ''

  if (!email || !password) {
    console.error('请提供管理员邮箱和密码：npm run admin:create -- <邮箱> <密码>')
    process.exit(1)
  }
  if (password.length < 6) {
    console.error('密码至少 6 位')
    process.exit(1)
  }

  try {
    await sequelize.authenticate()
    const hashed = await bcrypt.hash(password, 10)
    const [user, created] = await User.findOrCreate({
      where: { email },
      defaults: {
        email,
        nickname: '管理员',
        realName: '系统管理员',
        password: hashed,
        role: 'admin',
        status: 'active',
        campus: ''
      }
    })

    if (!created) {
      await user.update({ password: hashed, role: 'admin', status: 'active' })
    }

    console.log(`管理员账号已${created ? '创建' : '重置'}：${email}`)
    process.exit(0)
  } catch (err) {
    console.error('创建管理员失败：', err.message)
    process.exit(1)
  }
}

main()
