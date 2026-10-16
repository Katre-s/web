import { Op } from 'sequelize'
import { Product, ProductImage, User } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export async function listBooks(req, res, next) {
  try {
    const { keyword } = req.query
    const where = { status: 'available' }
    if (keyword) {
      where[Op.or] = [
        { bookTitle: { [Op.like]: `%${keyword}%` } },
        { title: { [Op.like]: `%${keyword}%` } },
        { bookAuthor: { [Op.like]: `%${keyword}%` } },
        { isbn: { [Op.like]: `%${keyword}%` } }
      ]
    }

    const products = await Product.findAll({
      where,
      order: [['created_at', 'DESC']],
      include: [{ model: ProductImage, as: 'images' }]
    })

    const bookMap = new Map()
    for (const p of products) {
      const key = p.isbn || `${p.bookTitle || p.title}__${p.bookAuthor || ''}`
      const cover = p.bookCover || p.images?.[0]?.imagePath || ''
      if (!bookMap.has(key)) {
        bookMap.set(key, {
          isbn: p.isbn,
          bookTitle: p.bookTitle || p.title,
          bookAuthor: p.bookAuthor,
          bookPublisher: p.bookPublisher,
          edition: p.edition,
          bookCover: cover,
          minPrice: Number(p.price),
          sellerCount: 1
        })
      } else {
        const item = bookMap.get(key)
        item.minPrice = Math.min(item.minPrice, Number(p.price))
        item.sellerCount++
        if (!item.edition && p.edition) item.edition = p.edition
        if (!item.bookCover && cover) item.bookCover = cover
        if (!item.bookPublisher && p.bookPublisher) item.bookPublisher = p.bookPublisher
      }
    }

    success(res, Array.from(bookMap.values()))
  } catch (err) { next(err) }
}

export async function bookDetail(req, res, next) {
  try {
    const key = decodeURIComponent(req.params.key)
    const where = {
      status: 'available',
      [Op.or]: [
        { isbn: key },
        { bookTitle: key },
        { title: key }
      ]
    }

    const products = await Product.findAll({
      where,
      order: [['created_at', 'DESC']],
      include: [
        { model: ProductImage, as: 'images' },
        { model: User, as: 'seller', attributes: ['id', 'nickname', 'campus'] }
      ]
    })

    if (!products.length) return fail(res, '书籍不存在', 404)

    const first = products[0]
    const cover = first.bookCover || first.images?.[0]?.imagePath || ''
    const book = {
      isbn: first.isbn,
      bookTitle: first.bookTitle || first.title,
      bookAuthor: first.bookAuthor,
      bookPublisher: first.bookPublisher,
      edition: first.edition,
      bookCover: cover,
      originalPrice: Number(first.originalPrice) || 0
    }

    const sellers = products.map((p) => ({
      id: p.id,
      price: Number(p.price),
      condition: p.condition,
      delivery: !!p.delivery,
      createdAt: p.created_at,
      description: p.description,
      campus: p.seller?.campus || '',
      sellerId: p.seller?.id,
      sellerNickname: p.seller?.nickname || ''
    }))

    success(res, { book, sellers })
  } catch (err) { next(err) }
}