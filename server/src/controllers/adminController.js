import { Op, QueryTypes } from 'sequelize'
import { sequelize, User, Product, Order, OrderItem, Hotspot, PlazaPost, ProductImage, Book, Notification, CartItem, Favorite, BalanceLog, AfterSale } from '../models/index.js'
import { success, fail } from '../utils/response.js'
import { TRADE_CATEGORIES, normalizeCategory } from '../config/categories.js'

export async function stats(req, res, next) {
  try {
    const [userCount, productCount, orderCount, hotspotCount, plazaCount, aftersalePending, bannedCount] = await Promise.all([
      User.count(),
      Product.count(),
      Order.count(),
      Hotspot.count({ where: { status: 'active' } }),
      PlazaPost.count({ where: { status: 'active' } }),
      AfterSale.count({ where: { status: ['pending', 'seller_rejected', 'appealed'] } }),
      User.count({ where: { status: 'banned' } })
    ])
    const recentUsers = await User.findAll({ order: [['id', 'DESC']], limit: 5, attributes: ['id', 'email', 'nickname', 'campus', 'role', 'status', ['created_at', 'created_at']] })
    success(res, { userCount, productCount, orderCount, hotspotCount, plazaCount, aftersalePending, bannedCount, recentUsers })
  } catch (err) { next(err) }
}

export async function users(req, res, next) {
  try {
    const { keyword = '', page = 1, pageSize = 20 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { email: { [Op.like]: `%${keyword}%` } },
        { nickname: { [Op.like]: `%${keyword}%` } },
        { realName: { [Op.like]: `%${keyword}%` } }
      ]
    }
    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: ['id', 'email', 'userNo', 'nickname', 'realName', 'campus', 'role', 'status', 'balance', ['created_at', 'created_at']],
      order: [['id', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    success(res, { list: rows, total: count })
  } catch (err) { next(err) }
}

export async function updateUser(req, res, next) {
  try {
    const { id } = req.params
    const { status, role, balance } = req.body
    const user = await User.findByPk(id)
    if (!user) return fail(res, '用户不存在', 404)
    if (Number(id) === req.user.id && status === 'banned') {
      return fail(res, '不能封禁自己')
    }
    if (status) user.status = status
    if (role) user.role = role
    if (balance !== undefined && balance !== null && balance !== '') {
      const bal = Number(balance)
      if (Number.isNaN(bal) || bal < 0) return fail(res, '余额必须为非负数字')
      const diff = bal - Number(user.balance)
      user.balance = bal
      if (diff !== 0) {
        await BalanceLog.create({
          userId: Number(id),
          type: 'admin',
          amount: diff,
          balanceAfter: bal,
          note: `管理员调整余额${diff > 0 ? '上调' : '下调'} ¥${Math.abs(diff).toFixed(2)}`
        })
      }
    }
    await user.save()
    success(res, null, '操作成功')
  } catch (err) { next(err) }
}

export async function updateUserNo(req, res, next) {
  try {
    const { id } = req.params
    const { userNo } = req.body
    if (!userNo || !/^\d{8}$/.test(userNo)) return fail(res, 'ID必须为8位数字')

    const user = await User.findByPk(id)
    if (!user) return fail(res, '用户不存在', 404)

    const oldNo = user.userNo
    if (oldNo === userNo) return fail(res, '新ID与原ID相同')

    const exists = await User.findOne({ where: { userNo, id: { [Op.ne]: id } } })
    if (exists) return fail(res, '该ID已被其他用户使用')

    await user.update({ userNo })
    await Notification.create({
      userId: id,
      type: 'system',
      content: `您的ID已从「${oldNo || '无'}」更改为「${userNo}」`
    })
    success(res, null, 'ID修改成功，已通知用户')
  } catch (err) { next(err) }
}

export async function createBook(req, res, next) {
  try {
    const { title, bookTitle, bookAuthor, bookPublisher, edition, description, price, originalPrice, category, isbn } = req.body
    if (!bookTitle && !title) return fail(res, '请输入书名')
    if (!bookAuthor) return fail(res, '请输入作者')
    if (!price) return fail(res, '请输入建议价格')

    const finalTitle = bookTitle || title
    const product = await Product.create({
      userId: req.user.id,
      title: finalTitle,
      bookTitle: finalTitle,
      bookAuthor,
      bookPublisher: bookPublisher || '',
      edition: edition || '',
      description: description || '',
      price,
      originalPrice: originalPrice || price,
      category: category || '其他',
      isbn: isbn || '',
      condition: '全新',
      delivery: true,
      status: 'available'
    })

    if (req.files && req.files.length) {
      const coverPath = `/uploads/${req.files[0].filename}`
      await product.update({ bookCover: coverPath })
      await ProductImage.bulkCreate(
        req.files.map((f, i) => ({
          productId: product.id,
          imagePath: `/uploads/${f.filename}`,
          sortOrder: i
        }))
      )
    }

    const cleanIsbn = (isbn || '').replace(/[-\s]/g, '')
    let bookRecord = null
    if (cleanIsbn) {
      bookRecord = await Book.findOne({ where: { isbn: cleanIsbn } })
    }
    if (!bookRecord) {
      bookRecord = await Book.findOne({ where: { bookTitle: finalTitle } })
    }
    if (!bookRecord) {
      await Book.create({
        isbn: cleanIsbn,
        bookTitle: finalTitle,
        bookAuthor: bookAuthor || '',
        bookPublisher: bookPublisher || '',
        bookCover: req.files?.length ? `/uploads/${req.files[0].filename}` : '',
        edition: edition || '',
        originalPrice: originalPrice || price,
        createdBy: req.user.id
      })
    }

    success(res, product, '新书上架成功')
  } catch (err) { next(err) }
}

export async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findByPk(req.params.id)
    if (!product) return fail(res, '商品不存在', 404)
    // 级联清理：图片、购物车条目、收藏，避免孤儿数据导致前端崩溃
    await ProductImage.destroy({ where: { productId: product.id } })
    await CartItem.destroy({ where: { productId: product.id } })
    await Favorite.destroy({ where: { productId: product.id } })
    await product.destroy()
    success(res, null, '商品已删除')
  } catch (err) { next(err) }
}
/* ---- 物品管理（商品列表 + 二级分类） ---- */
export async function listItems(req, res, next) {
  try {
    const { keyword = '', category = '', status = 'available', page = 1, pageSize = 20 } = req.query
    const where = {}
    if (category) where.category = category
    // 物品管理只存未售商品；已售的进「已售物品」
    where.status = status || 'available'
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { bookTitle: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
        { isbn: { [Op.like]: `%${keyword}%` } }
      ]
    }
    const { rows, count } = await Product.findAndCountAll({
      where,
      include: [
        { model: ProductImage, as: 'images' },
        { model: User, as: 'seller', attributes: ['id', 'nickname', 'userNo', 'campus'] }
      ],
      order: [['created_at', 'DESC']],
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      distinct: true
    })
    success(res, { list: rows, total: count, categories: TRADE_CATEGORIES })
  } catch (err) { next(err) }
}

export async function updateItem(req, res, next) {
  try {
    const item = await Product.findByPk(req.params.id)
    if (!item) return fail(res, '物品不存在', 404)

    const { category, status } = req.body
    if (category !== undefined && category !== '') {
      const next = normalizeCategory(category)
      if (!TRADE_CATEGORIES.includes(next)) return fail(res, '无效的类目')
      item.category = next
      if (next === '图书') {
        // 归到图书时补齐书目板块，否则交易页「图书」聚合视图看不到它
        item.bookTitle = item.bookTitle || item.title
        const exists = await Book.findOne({
          where: item.isbn ? { isbn: item.isbn } : { bookTitle: item.bookTitle }
        })
        if (!exists) {
          await Book.create({
            isbn: item.isbn || '',
            bookTitle: item.bookTitle,
            bookAuthor: item.bookAuthor || '',
            bookPublisher: item.bookPublisher || '',
            bookCover: item.bookCover || '',
            edition: item.edition || '',
            originalPrice: item.originalPrice || 0,
            createdBy: item.userId
          })
        }
      }
    }
    if (status) {
      if (!['available', 'sold', 'off'].includes(status)) return fail(res, '无效的状态')
      item.status = status
    }
    await item.save()
    success(res, item.toJSON(), '已更新')
  } catch (err) { next(err) }
}

export async function listBoards(req, res, next) {
  try {
    const { keyword } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { bookTitle: { [Op.like]: `%${keyword}%` } },
        { bookAuthor: { [Op.like]: `%${keyword}%` } },
        { isbn: { [Op.like]: `%${keyword}%` } }
      ]
    }
    const books = await Book.findAll({ where, order: [['id', 'DESC']] })
    if (!books.length) return success(res, [])

    // 批量分组统计在售数，避免逐个板块查询(N+1)
    const isbns = books.map(b => b.isbn).filter(Boolean)
    const titles = books.map(b => b.bookTitle).filter(Boolean)
    const countBy = new Map()
    const queries = []
    if (isbns.length) {
      queries.push(
        Product.findAll({
          attributes: ['isbn', [sequelize.fn('COUNT', sequelize.col('id')), 'cnt']],
          where: { isbn: isbns, status: 'available' },
          group: ['isbn'],
          raw: true
        }).then(rows => rows.forEach(r => countBy.set(`isbn:${r.isbn}`, Number(r.cnt))))
      )
    }
    if (titles.length) {
      queries.push(
        Product.findAll({
          attributes: ['book_title', [sequelize.fn('COUNT', sequelize.col('id')), 'cnt']],
          where: { bookTitle: titles, status: 'available' },
          group: ['book_title'],
          raw: true
        }).then(rows => rows.forEach(r => countBy.set(`title:${r.book_title}`, Number(r.cnt))))
      )
    }
    await Promise.all(queries)

    const result = books.map(b => ({
      ...b.toJSON(),
      productCount: b.isbn
        ? (countBy.get(`isbn:${b.isbn}`) || (countBy.get(`title:${b.bookTitle}`) || 0))
        : (countBy.get(`title:${b.bookTitle}`) || 0)
    }))
    success(res, result)
  } catch (err) { next(err) }
}

export async function deleteBoard(req, res, next) {
  try {
    const book = await Book.findByPk(req.params.id)
    if (!book) return fail(res, '板块不存在', 404)

    const prodWhere = book.isbn ? { isbn: book.isbn } : { bookTitle: book.bookTitle }
    const products = await Product.findAll({ where: prodWhere, attributes: ['id'] })
    const productIds = products.map(p => p.id)
    if (productIds.length) {
      await ProductImage.destroy({ where: { productId: productIds } })
      await CartItem.destroy({ where: { productId: productIds } })
      await Favorite.destroy({ where: { productId: productIds } })
      await Product.destroy({ where: { id: productIds } })
    }
    await book.destroy()
    success(res, null, `板块已删除，同时删除${products.length}个商品`)
  } catch (err) { next(err) }
}
export async function updateBoardCover(req, res, next) {
  try {
    const book = await Book.findByPk(req.params.id)
    if (!book) return fail(res, '板块不存在', 404)
    if (!req.file) return fail(res, '请上传图片')
    await book.update({ bookCover: `/uploads/${req.file.filename}` })
    success(res, { bookCover: `/uploads/${req.file.filename}` }, '封面已更新')
  } catch (err) { next(err) }
}

export async function updateBoard(req, res, next) {
  try {
    const book = await Book.findByPk(req.params.id)
    if (!book) return fail(res, '板块不存在', 404)

    const { bookTitle, bookAuthor, bookPublisher, edition, isbn, originalPrice } = req.body
    if (!bookTitle || !String(bookTitle).trim()) return fail(res, '书名不能为空')

    if (isbn && isbn !== book.isbn) {
      const exists = await Book.findOne({ where: { isbn, id: { [Op.ne]: book.id } } })
      if (exists) return fail(res, '该ISBN已被其他板块使用')
    }

    await book.update({
      bookTitle: String(bookTitle).trim(),
      bookAuthor: bookAuthor || '',
      bookPublisher: bookPublisher || '',
      edition: edition || '',
      isbn: isbn || '',
      originalPrice: Number(originalPrice) || 0
    })
    success(res, book.toJSON(), '板块信息已更新')
  } catch (err) { next(err) }
}

export async function listNotifications(req, res, next) {
  try {
    const all = await Notification.findAll({
      order: [['id', 'DESC']],
      limit: 100
    })
    const seen = new Map()
    for (const n of all) {
      const key = `${n.type}_${n.content}`
      if (!seen.has(key)) {
        seen.set(key, n)
      }
    }
    const list = [...seen.values()].map((n) => ({
      id: n.id,
      type: n.type,
      content: n.content,
      isRead: n.isRead,
      time: n.created_at
    }))
    success(res, list)
  } catch (err) { next(err) }
}

export async function deleteNotification(req, res, next) {
  try {
    const { id } = req.params
    const target = await Notification.findByPk(id)
    if (!target) return fail(res, '通知不存在', 404)
    const count = await Notification.destroy({
      where: { type: target.type, content: target.content }
    })
    success(res, null, `已删除${count}条通知`)
  } catch (err) { next(err) }
}


/* ---- 后台图表：近 7 天上架 / 单日分时段 / 类目交易额 ---- */
function fmtDate(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export async function charts(req, res, next) {
  try {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - 6)

    const rows = await sequelize.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, HOUR(created_at) AS h, COUNT(*) AS c
       FROM products
       WHERE created_at >= :start
       GROUP BY d, h`,
      { replacements: { start: `${fmtDate(start)} 00:00:00` }, type: QueryTypes.SELECT }
    )

    const days = []
    const hourly = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const key = fmtDate(d)
      days.push({ date: key, count: 0 })
      hourly[key] = Array.from({ length: 24 }, () => 0)
    }
    const dayMap = new Map(days.map((d) => [d.date, d]))
    for (const r of rows) {
      const day = dayMap.get(r.d)
      const count = Number(r.c) || 0
      if (!day) continue
      day.count += count
      if (hourly[r.d]) hourly[r.d][Number(r.h)] = count
    }

    const catRows = await sequelize.query(
      `SELECT p.category AS category, SUM(oi.price) AS amount
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
       JOIN products p ON p.id = oi.product_id
       GROUP BY p.category
       ORDER BY amount DESC`,
      { type: QueryTypes.SELECT }
    )
    const list = catRows.map((r) => ({
      category: r.category || '未分类',
      amount: Number(r.amount) || 0
    }))
    const totalAmount = list.reduce((sum, i) => sum + i.amount, 0)
    const category = list.map((i) => ({
      ...i,
      percent: totalAmount > 0 ? Number(((i.amount / totalAmount) * 100).toFixed(1)) : 0
    }))

    success(res, { days, hourly, category, totalAmount })
  } catch (err) { next(err) }
}


/* ---- 图书板块管理（图书种类） ---- */

/** 板块列表：含在售/已售数量与封面 */
export async function listBookBoards(req, res, next) {
  try {
    const { keyword = '', page = 1, pageSize = 20 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { bookTitle: { [Op.like]: `%${keyword}%` } },
        { bookAuthor: { [Op.like]: `%${keyword}%` } },
        { isbn: { [Op.like]: `%${keyword}%` } }
      ]
    }
    const { rows, count } = await Book.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize)
    })
    const list = []
    for (const b of rows) {
      const cond = b.isbn
        ? { isbn: b.isbn }
        : { [Op.or]: [{ bookTitle: b.bookTitle }, { title: b.bookTitle }] }
      const [availableCount, soldCount] = await Promise.all([
        Product.count({ where: { ...cond, status: 'available' } }),
        Product.count({ where: { ...cond, status: 'sold' } })
      ])
      list.push({ ...b.toJSON(), availableCount, soldCount })
    }
    success(res, { list, total: count })
  } catch (err) { next(err) }
}

function pickBookFields(body) {
  return {
    isbn: String(body.isbn || '').replace(/[-\s]/g, ''),
    bookTitle: String(body.bookTitle || '').trim(),
    bookAuthor: String(body.bookAuthor || '').trim(),
    bookPublisher: String(body.bookPublisher || '').trim(),
    edition: String(body.edition || '').trim(),
    description: String(body.description || '').trim(),
    bookCover: String(body.bookCover || '').trim(),
    originalPrice: Number(body.originalPrice) || 0
  }
}

/** 新建板块 */
export async function createBookBoard(req, res, next) {
  try {
    const fields = pickBookFields(req.body)
    if (!fields.bookTitle) return fail(res, '请填写书名')
    if (fields.isbn) {
      const dup = await Book.findOne({ where: { isbn: fields.isbn } })
      if (dup) return fail(res, `该 ISBN 已存在板块（#${dup.id} ${dup.bookTitle}）`)
    }
    const board = await Book.create({ ...fields, createdBy: req.user.id })
    success(res, board, '板块已创建')
  } catch (err) { next(err) }
}

/** 编辑板块信息（书名/作者/出版社/版本/ISBN/简介/封面/定价） */
export async function updateBookBoard(req, res, next) {
  try {
    const board = await Book.findByPk(req.params.id)
    if (!board) return fail(res, '板块不存在', 404)
    const fields = pickBookFields(req.body)
    if (!fields.bookTitle) return fail(res, '请填写书名')
    if (fields.isbn && fields.isbn !== board.isbn) {
      const dup = await Book.findOne({ where: { isbn: fields.isbn } })
      if (dup) return fail(res, `该 ISBN 已存在板块（#${dup.id} ${dup.bookTitle}）`)
    }
    await board.update(fields)
    success(res, board, '板块已更新')
  } catch (err) { next(err) }
}

/** 删除板块 */
export async function deleteBookBoard(req, res, next) {
  try {
    const board = await Book.findByPk(req.params.id)
    if (!board) return fail(res, '板块不存在', 404)
    await board.destroy()
    success(res, {}, '板块已删除')
  } catch (err) { next(err) }
}

/* ---- 已售物品（全部已成交订单） ---- */

export async function listSoldOrders(req, res, next) {
  try {
    const { keyword = '', page = 1, pageSize = 20 } = req.query
    const where = { status: 'completed' }
    const { rows, count } = await Order.findAndCountAll({
      where,
      include: [
        { model: User, as: 'buyer', attributes: ['id', 'nickname', 'userNo'] },
        {
          model: OrderItem,
          as: 'items',
          include: [{
            model: Product,
            as: 'product',
            attributes: ['id', 'title', 'bookTitle', 'bookCover', 'category', 'price', 'userId'],
            include: [{ model: User, as: 'seller', attributes: ['id', 'nickname', 'userNo'] }]
          }]
        }
      ],
      order: [['created_at', 'DESC']],
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      distinct: true
    })
    success(res, { list: rows, total: count })
  } catch (err) { next(err) }
}
