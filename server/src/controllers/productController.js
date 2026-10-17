import { Op } from 'sequelize'
import { Product, ProductImage, User, Favorite, Book, Order, OrderItem } from '../models/index.js'
import { success, fail } from '../utils/response.js'

const orderMap = {
  newest: [['created_at', 'DESC']],
  price_asc: [['price', 'ASC']],
  price_desc: [['price', 'DESC']]
}

async function findOrCreateBook({ isbn, bookTitle, bookAuthor, bookPublisher, bookCover, edition, originalPrice, userId }) {
  if (!bookTitle) return null
  const cleanIsbn = (isbn || '').replace(/[-\s]/g, '')
  let book = null
  if (cleanIsbn) {
    book = await Book.findOne({ where: { isbn: cleanIsbn } })
  }
  if (!book) {
    book = await Book.findOne({ where: { bookTitle, bookAuthor: bookAuthor || '' } })
  }
  if (!book) {
    book = await Book.create({
      isbn: cleanIsbn,
      bookTitle,
      bookAuthor: bookAuthor || '',
      bookPublisher: bookPublisher || '',
      bookCover: bookCover || '',
      edition: edition || '',
      originalPrice: originalPrice || 0,
      createdBy: userId
    })
  } else {
    const updates = {}
    if (!book.isbn && cleanIsbn) updates.isbn = cleanIsbn
    if (!book.bookCover && bookCover) updates.bookCover = bookCover
    if (!book.bookPublisher && bookPublisher) updates.bookPublisher = bookPublisher
    if (!book.bookAuthor && bookAuthor) updates.bookAuthor = bookAuthor
    if (!book.edition && edition) updates.edition = edition
    if ((!book.originalPrice || Number(book.originalPrice) === 0) && originalPrice) updates.originalPrice = originalPrice
    if (Object.keys(updates).length) await book.update(updates)
  }
  return book
}

export async function list(req, res, next) {
  try {
    const { keyword, category, sort = 'newest', page = 1, pageSize = 20 } = req.query
    const where = { status: 'available' }
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { bookTitle: { [Op.like]: `%${keyword}%` } },
        { bookAuthor: { [Op.like]: `%${keyword}%` } },
        { isbn: { [Op.like]: `%${keyword}%` } }
      ]
    }
    if (category) where.category = category

    const { rows, count } = await Product.findAndCountAll({
      where,
      order: orderMap[sort] || orderMap.newest,
      offset: (page - 1) * pageSize,
      limit: Number(pageSize),
      include: [{ model: ProductImage, as: 'images' }]
    })
    success(res, rows, `共${count}条`)
  } catch (err) { next(err) }
}

export async function detail(req, res, next) {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: ProductImage, as: 'images' }, { model: User, as: 'seller', attributes: ['id', 'nickname', 'avatar', 'campus'] }]
    })
    if (!product) return fail(res, '商品不存在', 404)
    success(res, product)
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const userId = req.user.id
    const { isbn, bookTitle, bookAuthor, bookPublisher, bookCover, originalPrice,
            edition, delivery, price, condition, category, description } = req.body
    const title = bookTitle || req.body.title || '未命名书籍'

    let finalCover = ''
    if (req.files && req.files.length) {
      finalCover = `/uploads/${req.files[0].filename}`
    }
    if (!finalCover) {
      finalCover = bookCover || ''
    }

    const product = await Product.create({
      userId, title, isbn: (isbn || '').replace(/[-\s]/g, ''), bookTitle, bookAuthor, bookPublisher,
      bookCover: finalCover,
      edition: edition || '', delivery: delivery !== 'false' && delivery !== false,
      originalPrice: originalPrice || 0, price, condition, category, description,
      status: 'available'
    })

    if (req.files && req.files.length) {
      await ProductImage.bulkCreate(
        req.files.map((f, i) => ({
          productId: product.id,
          imagePath: `/uploads/${f.filename}`,
          sortOrder: i
        }))
      )
    }

    await findOrCreateBook({
      isbn, bookTitle: title, bookAuthor, bookPublisher,
      bookCover: bookCover || '', edition, originalPrice, userId
    })

    success(res, product, '发布成功')
  } catch (err) { next(err) }
}

export async function update(req, res, next) {
  try {
    const product = await Product.findByPk(req.params.id)
    if (!product) return fail(res, '商品不存在', 404)
    if (product.userId !== req.user.id) return fail(res, '无权操作', 403)
    await product.update(req.body)
    success(res, product, '更新成功')
  } catch (err) { next(err) }
}

export async function remove(req, res, next) {
  try {
    const product = await Product.findByPk(req.params.id)
    if (!product) return fail(res, '商品不存在', 404)
    if (product.userId !== req.user.id) return fail(res, '无权操作', 403)
    await ProductImage.destroy({ where: { productId: product.id } })
    await product.destroy()
    success(res, null, '删除成功')
  } catch (err) { next(err) }
}

export async function myProducts(req, res, next) {
  try {
    const products = await Product.findAll({
      where: { userId: req.user.id },
      order: [['created_at', 'DESC']],
      include: [{ model: ProductImage, as: 'images' }]
    })

    const soldIds = products.filter(p => p.status === 'sold').map(p => p.id)
    const buyerMap = new Map()
    if (soldIds.length) {
      const orderItems = await OrderItem.findAll({
        where: { productId: soldIds },
        include: [{ model: Order, as: 'order', attributes: ['id', 'buyerId'] }]
      })
      const buyerIds = [...new Set(orderItems.map(i => i.order?.buyerId).filter(Boolean))]
      const buyers = buyerIds.length ? await User.findAll({
        where: { id: buyerIds },
        attributes: ['id', 'nickname', 'avatar', 'userNo']
      }) : []
      const buyerInfoMap = new Map(buyers.map(b => [b.id, b]))
      for (const item of orderItems) {
        if (item.order?.buyerId && !buyerMap.has(item.productId)) {
          buyerMap.set(item.productId, buyerInfoMap.get(item.order.buyerId) || null)
        }
      }
    }

    const result = products.map(p => {
      const json = p.toJSON()
      if (json.status === 'sold') {
        json.buyer = buyerMap.get(p.id) || null
      }
      return json
    })
    success(res, result)
  } catch (err) { next(err) }
}