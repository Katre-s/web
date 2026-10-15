import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import errorHandler from './middlewares/errorHandler.js'
import { sequelize } from './models/index.js'
import { testConnection } from './config/database.js'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import bookRoutes from './routes/book.js'
import cartRoutes from './routes/cart.js'
import orderRoutes from './routes/orders.js'
import wishlistRoutes from './routes/wishlist.js'
import favoriteRoutes from './routes/favorites.js'
import messageRoutes from './routes/messages.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/book', bookRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/wishlist', wishlistRoutes)
app.use('/api/favorites', favoriteRoutes)
app.use('/api/messages', messageRoutes)

app.get('/api/health', (req, res) => res.json({ code: 0, message: 'ok' }))

app.use(errorHandler)

const PORT = process.env.PORT || 3000

async function start() {
  await testConnection()
  await sequelize.sync({ alter: true })
  app.listen(PORT, () => {
    console.log(`文衡 API 服务已启动: http://localhost:${PORT}`)
  })
}

start().catch(err => console.error('启动失败:', err))