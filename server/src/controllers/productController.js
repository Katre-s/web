import { Op } from 'sequelize'
import { Product, ProductImage, User, Favorite, Book, Order, OrderItem, CartItem, AfterSale } from '../models/index.js'
import { success, fail } from '../utils/response.js'
import { normalizeCategory, isBookCategory } from '../config/categories.js'

const orderMap = {
  newest: [['created_at', 'DESC']],
  price_asc: [['price', 'ASC']],
  price_desc: [['price', 'DESC']]
}

/**
 * 交易方式只对「出行」类目开放（自行车、电动车可以租），其余类目一律按出售处理。
 * 这样前端就算传了 rent，也不会出现"租一个台灯"这种脏数据。
 */
function normalizeDealType(value, category) {
  if (category !== '出行') return 'sell'
  return String(value || '').toLowerCase() === 'rent' ? 'rent' : 'sell'
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
    const { keyword, category, sort = 'newest', page = 1, pageSize = 20, dealType } = req.query
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
    // 出行类目的三级筛选：出售 / 出租。
    // 老数据这列可能是 NULL（补列没跑成时），「出售」要把 NULL 也算进来，否则老商品会集体消失
    if (dealType === 'rent') where.dealType = 'rent'
    else if (dealType === 'sell') where.dealType = { [Op.or]: ['sell', null] }

    const { rows, count } = await Product.findAndCountAll({
      where,
      order: orderMap[sort] || orderMap.newest,
      offset: (page - 1) * pageSize,
      limit: Number(pageSize),
      include: [
        { model: ProductImage, as: 'images' },
        { model: User, as: 'seller', attributes: ['id', 'nickname', 'campus'] }
      ]
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
            edition, delivery, price, condition, description } = req.body
    const category = normalizeCategory(req.body.category)
    const isBook = isBookCategory(category)
    // 图书沿用书名，其他类目用通用「商品标题」
    const title = isBook
      ? (bookTitle || req.body.title || '')
      : (req.body.title || bookTitle || '')
    if (!title) return fail(res, isBook ? '请填写书名' : '请填写商品标题')

    let finalCover = ''
    if (req.files && req.files.length) {
      finalCover = `/uploads/${req.files[0].filename}`
    }
    if (!finalCover) {
      finalCover = bookCover || ''
    }

    const product = await Product.create({
      userId,
      title,
      isbn: isBook ? (isbn || '').replace(/[-\s]/g, '') : '',
      bookTitle: isBook ? (bookTitle || title) : '',
      bookAuthor: isBook ? (bookAuthor || '') : '',
      bookPublisher: isBook ? (bookPublisher || '') : '',
      bookCover: finalCover,
      edition: isBook ? (edition || '') : '',
      delivery: delivery !== 'false' && delivery !== false,
      originalPrice: isBook ? (originalPrice || 0) : 0,
      price,
      condition: condition || (category === '租房' ? '' : '九成新'),
      category,
      dealType: normalizeDealType(req.body.dealType, category),
      description,
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

    // 只有图书才维护「书目板块」，其他类目是独立的二手商品
    if (isBook) {
      // 注意：必须传实际上传的封面 finalCover（而非请求体里的 bookCover 字段），
      // 否则用户上传图片发布的书，Book 目录表的 bookCover 会一直是空，
      // 后台「图书种类」里就看不到其他用户上传的图书照片。
      await findOrCreateBook({
        isbn, bookTitle: title, bookAuthor, bookPublisher,
        bookCover: finalCover, edition, originalPrice, userId
      })
    }

    success(res, product, '发布成功')
  } catch (err) { next(err) }
}

export async function update(req, res, next) {
  try {
    const product = await Product.findByPk(req.params.id)
    if (!product) return fail(res, '商品不存在', 404)
    if (product.userId !== req.user.id) return fail(res, '无权操作', 403)
    const patch = { ...req.body }
    // 改类目或交易方式时重新归一：非出行类目强制回 sell
    if (patch.dealType !== undefined || patch.category !== undefined) {
      patch.dealType = normalizeDealType(patch.dealType ?? product.dealType, patch.category ?? product.category)
    }
    await product.update(patch)
    success(res, product, '更新成功')
  } catch (err) { next(err) }
}

export async function remove(req, res, next) {
  try {
    const product = await Product.findByPk(req.params.id)
    if (!product) return fail(res, '商品不存在', 404)
    if (product.userId !== req.user.id) return fail(res, '无权操作', 403)
    // 级联清理：图片、购物车条目、收藏，避免孤儿数据导致前端崩溃
    await ProductImage.destroy({ where: { productId: product.id } })
    await CartItem.destroy({ where: { productId: product.id } })
    await Favorite.destroy({ where: { productId: product.id } })
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
    const aftersaleProductIds = new Set()
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

      // 有售后记录的已售商品不进「已售出」，统一展示在「售后处理」
      const orderIds = [...new Set(orderItems.map(i => i.order?.id).filter(Boolean))]
      if (orderIds.length) {
        const sales = await AfterSale.findAll({
          where: { orderId: orderIds },
          attributes: ['orderId'],
          raw: true
        })
        const itemByOrder = new Map()
        for (const item of orderItems) {
          if (item.order?.id && !itemByOrder.has(item.order.id)) itemByOrder.set(item.order.id, item.productId)
        }
        for (const rec of sales) {
          const pid = itemByOrder.get(rec.orderId)
          if (pid) aftersaleProductIds.add(pid)
        }
      }
    }

    const result = products
      .filter(p => !(p.status === 'sold' && aftersaleProductIds.has(p.id)))
      .map(p => {
        const json = p.toJSON()
        if (json.status === 'sold') {
          json.buyer = buyerMap.get(p.id) || null
        }
        return json
      })
    success(res, result)
  } catch (err) { next(err) }
}