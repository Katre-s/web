import { Op } from 'sequelize'
import { User, Product, Order, Hotspot, ProductImage, Book, Notification } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export async function stats(req, res, next) {
  try {
    const [userCount, productCount, orderCount, hotspotCount, bannedCount] = await Promise.all([
      User.count(),
      Product.count(),
      Order.count(),
      Hotspot.count({ where: { status: 'active' } }),
      User.count({ where: { status: 'banned' } })
    ])
    const recentUsers = await User.findAll({ order: [['id', 'DESC']], limit: 5, attributes: ['id', 'email', 'nickname', 'campus', 'role', 'status', ['created_at', 'created_at']] })
    success(res, { userCount, productCount, orderCount, hotspotCount, bannedCount, recentUsers })
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
      attributes: ['id', 'email', 'userNo', 'nickname', 'realName', 'campus', 'role', 'status', ['created_at', 'created_at']],
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
    const { status, role } = req.body
    const user = await User.findByPk(id)
    if (!user) return fail(res, '用户不存在', 404)
    if (Number(id) === req.user.id && status === 'banned') {
      return fail(res, '不能封禁自己')
    }
    if (status) user.status = status
    if (role) user.role = role
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
    await product.destroy()
    success(res, null, '商品已删除')
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
    const result = []
    for (const b of books) {
      const count = await Product.count({
        where: b.isbn ? { isbn: b.isbn, status: 'available' } : { bookTitle: b.bookTitle, status: 'available' }
      })
      result.push({ ...b.toJSON(), productCount: count })
    }
    success(res, result)
  } catch (err) { next(err) }
}

export async function deleteBoard(req, res, next) {
  try {
    const book = await Book.findByPk(req.params.id)
    if (!book) return fail(res, '板块不存在', 404)

    const prodWhere = book.isbn ? { isbn: book.isbn } : { bookTitle: book.bookTitle }
    const products = await Product.findAll({ where: prodWhere, attributes: ['id'] })
    for (const p of products) {
      await ProductImage.destroy({ where: { productId: p.id } })
      await p.destroy()
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
      limit: 500
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