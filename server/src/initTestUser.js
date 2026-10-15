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
      `INSERT INTO users (email, nickname, realName, password, createdAt, updatedAt)
       VALUES (:email, :nickname, :realName, :password, NOW(), NOW())
       ON DUPLICATE KEY UPDATE password = :password`,
      {
        replacements: { email, nickname: '测试同学', realName: '测试用户', password: hashed }
      }
    )

    console.log('Test account created:')
    console.log('  Email: test@wenheng.edu')
    console.log('  Password: 123456')

    const [rows] = await sequelize.query('SELECT id, email, nickname FROM users')
    console.log('All users:', JSON.stringify(rows))
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await sequelize.close()
  }
}

main()