import dotenv from 'dotenv'
import { sequelize } from '../models/index.js'

dotenv.config()

async function initDB() {
  try {
    await sequelize.authenticate()
    console.log('数据库连接成功')
    await sequelize.sync({ force: false, alter: true })
    console.log('表结构同步完成')
    console.log('数据库初始化成功！')
    process.exit(0)
  } catch (err) {
    console.error('数据库初始化失败:', err.message)
    process.exit(1)
  }
}

initDB()