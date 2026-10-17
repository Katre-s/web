import { BookFavorite, Book, Product, ProductImage } from '../models/index.js'
import { Op } from 'sequelize'
import { success, fail } from '../utils/response.js'

export async function toggle(req, res, next) {
  try {
    const { bookId } = req.body
    const userId = req.user.id
    if (!bookId) return fail(res, '请指定板块')

    const exists = await BookFavorite.findOne({ where: { userId, bookId } })
    if (exists) {
      await exists.destroy()
      return success(res, { favorited: false }, '已取消收藏')
    }
    await BookFavorite.create({ userId, bookId })
    success(res, { favorited: true }, '已收藏')
  } catch (err) { next(err) }
}

export async function list(req, res, next) {
  try {
    const favorites = await BookFavorite.findAll({
      where: { userId: req.user.id },
      order: [['created_at', 'DESC']],
      include: [{ model: Book, as: 'book' }]
    })

    const result = []
    for (const f of favorites) {
      if (!f.book) continue
      const b = f.book
      const prodWhere = { status: 'available' }
      if (b.isbn) prodWhere.isbn = b.isbn
      else prodWhere[Op.or] = [{ bookTitle: b.bookTitle }, { title: b.bookTitle }]
      const products = await Product.findAll({
        where: prodWhere,
        attributes: ['id', 'price', 'bookCover'],
        order: [['created_at', 'DESC']]
      })
      result.push({
        id: b.id,
        isbn: b.isbn,
        bookTitle: b.bookTitle,
        bookAuthor: b.bookAuthor,
        bookPublisher: b.bookPublisher,
        edition: b.edition,
        bookCover: b.bookCover || products[0]?.bookCover || '',
        minPrice: products.length ? Math.min(...products.map(p => Number(p.price))) : 0,
        sellerCount: products.length
      })
    }
    success(res, result)
  } catch (err) { next(err) }
}

export async function check(req, res, next) {
  try {
    const { bookId } = req.params
    const exists = await BookFavorite.findOne({ where: { userId: req.user.id, bookId } })
    success(res, { favorited: !!exists })
  } catch (err) { next(err) }
}