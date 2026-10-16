import bcrypt from 'bcryptjs'
import { Sequelize } from 'sequelize'

const sequelize = new Sequelize('campus_trade', 'campus_user', 'wrn123', {
  host: 'localhost',
  dialect: 'mysql',
  logging: false
})

async function main() {
  try {
    await sequelize.authenticate()
    console.log('DB connected')

    const email = 'test@wenheng.edu'
    const password = '123456'
    const hashed = await bcrypt.hash(password, 10)

    await sequelize.query(
      `INSERT INTO users (email, nickname, real_name, password, created_at, updated_at, role)
       VALUES (:email, :nickname, :realName, :password, NOW(), NOW(), 'admin')
       ON DUPLICATE KEY UPDATE role = 'admin', real_name = :realName, nickname = :nickname`,
      {
        replacements: { email, nickname: '管理员', realName: '系统管理员', password: hashed }
      }
    )

    console.log('Admin account ready:')
    console.log('  Email: test@wenheng.edu')
    console.log('  Password: 123456')
    console.log('  Role: admin')

    const [rows] = await sequelize.query(
      "SELECT id, email, nickname, role, status FROM users WHERE role='admin'"
    )
    console.log('Admin users:', JSON.stringify(rows))
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await sequelize.close()
  }
}

main()