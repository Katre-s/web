import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import errorHandler from './middlewares/errorHandler.js'
import { sequelize } from './models/index.js'
import { Op as SequelizeOp } from 'sequelize'
import { testConnection } from './config/database.js'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import bookRoutes from './routes/book.js'
import booksRoutes from './routes/books.js'
import cartRoutes from './routes/cart.js'
import orderRoutes from './routes/orders.js'
import wishlistRoutes from './routes/wishlist.js'
import favoriteRoutes from './routes/favorites.js'
import messageRoutes from './routes/messages.js'
import hotspotRoutes from './routes/hotspots.js'
import notificationRoutes from './routes/notifications.js'
import adminRoutes from './routes/admin.js'
import conversationRoutes from './routes/conversations.js'
import bookFavoriteRoutes from './routes/bookFavorites.js'
import agentRoutes from './routes/agent.js'
import weatherRoutes from './routes/weather.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// 上传图长期缓存：文件名带时间戳+随机串，不会覆盖复用，可安全用强缓存
// 移动端二次进入页面时不再重复下载封面，图片"闪白/加载慢"明显改善
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '30d',
  immutable: true,
  fallthrough: true,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable')
  }
}))

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/book', bookRoutes)
app.use('/api/books', booksRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/wishlist', wishlistRoutes)
app.use('/api/favorites', favoriteRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/hotspots', hotspotRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/book-favorites', bookFavoriteRoutes)
app.use('/api/agent', agentRoutes)
app.use('/api/weather', weatherRoutes)

app.get('/api/health', (req, res) => res.json({ code: 0, message: 'ok' }))

app.use(errorHandler)

const PORT = process.env.PORT || 3000

async function start() {
  await testConnection()

  // 原来每次启动都跑 sync({ alter: true })：会逐表比对并可能重建索引/临时表，
  // 数据量一大就是几十秒启动耗时 + 锁表（表现为"打开页面卡、偶发超时"）。
  // 现在默认只做 sync()（不存在才建表），需要改表结构时用 DB_SYNC_ALTER=true 临时开启。
  const syncAlter = process.env.DB_SYNC_ALTER === 'true'
  await sequelize.sync(syncAlter ? { alter: true } : {})
  console.log(`[DB] sync 完成${syncAlter ? '(alter=true)' : ''}`)

  try {
    const { Product, Book } = await import('./models/index.js')
    const bookCount = await Book.count()
    if (bookCount === 0) {
      const products = await Product.findAll({ attributes: ['isbn', 'bookTitle', 'bookAuthor', 'bookPublisher', 'bookCover', 'edition', 'originalPrice', 'userId'] })
      const seen = new Set()
      for (const p of products) {
        const title = p.bookTitle || p.title
        if (!title) continue
        const key = p.isbn || title
        if (seen.has(key)) continue
        seen.add(key)
        await Book.create({
          isbn: p.isbn || '',
          bookTitle: title,
          bookAuthor: p.bookAuthor || '',
          bookPublisher: p.bookPublisher || '',
          bookCover: p.bookCover || '',
          edition: p.edition || '',
          originalPrice: p.originalPrice || 0,
          createdBy: p.userId
        })
      }
      console.log(`[迁移] 从Product迁移了${seen.size}条Book记录`)
    }
  } catch (err) {
    console.error('[迁移] 失败:', err.message)
  }

  try {
    const { User } = await import('./models/index.js')
    const users = await User.findAll({
      where: { [SequelizeOp.or]: [{ userNo: null }, { userNo: '' }] },
      order: [['id', 'ASC']]
    })
    let counter = 0
    const allUsers = await User.findAll({ attributes: ['userNo'], order: [['user_no', 'DESC']] })
    let maxNum = 0
    for (const u of allUsers) {
      const n = parseInt(u.userNo, 10)
      if (!isNaN(n) && n > maxNum) maxNum = n
    }
    let nextNum = maxNum + 1
    for (const u of users) {
      if (u.email === 'test@wenheng.edu') continue
      const no = String(nextNum).padStart(8, '0')
      await u.update({ userNo: no })
      nextNum++
      counter++
    }
    if (counter) console.log(`[迁移] 为${counter}个用户分配了userNo`)
  } catch (err) {
    console.error('[迁移userNo] 失败:', err.message)
  }

  try {
    const { Conversation, ChatMessage } = await import('./models/index.js')
    const convs = await Conversation.findAll({ order: [['last_message_at', 'ASC']] })
    const groupMap = new Map()
    for (const c of convs) {
      const key = `${Math.min(c.buyerId, c.sellerId)}_${Math.max(c.buyerId, c.sellerId)}`
      if (!groupMap.has(key)) groupMap.set(key, [])
      groupMap.get(key).push(c)
    }
    let merged = 0
    for (const [, group] of groupMap) {
      if (group.length < 2) continue
      const main = group[group.length - 1]
      for (const old of group.slice(0, -1)) {
        await ChatMessage.update({ conversationId: main.id }, { where: { conversationId: old.id } })
        await old.destroy()
        merged++
      }
      if (main.productId === null && group.some(c => c.productId)) {
        const withProduct = [...group].reverse().find(c => c.productId)
        if (withProduct) await main.update({ productId: withProduct.productId })
      }
    }
    if (merged) console.log(`[迁移] 合并了${merged}个重复对话`)
  } catch (err) {
    console.error('[迁移对话合并] 失败:', err.message)
  }

  app.listen(PORT, () => {
    console.log(`文衡 API 服务已启动: http://localhost:${PORT}`)
  })

  setInterval(async () => {
    try {
      const { Conversation, ChatMessage } = await import('./models/index.js')
      const expired = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const oldConvs = await Conversation.findAll({
        where: { lastMessageAt: { [SequelizeOp.lt]: expired } },
        attributes: ['id']
      })
      if (oldConvs.length) {
        const ids = oldConvs.map(c => c.id)
        await ChatMessage.destroy({ where: { conversationId: ids } })
        await Conversation.destroy({ where: { id: ids } })
        console.log(`[清理] 删除${oldConvs.length}个过期对话`)
      }
    } catch (err) {
      console.error('[清理] 定时清理失败:', err.message)
    }
  }, 60 * 60 * 1000)
}

start().catch(err => console.error('启动失败:', err))