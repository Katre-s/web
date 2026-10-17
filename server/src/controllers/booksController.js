import { Op } from 'sequelize'
import { Product, ProductImage, User, Book } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export async function listBooks(req, res, next) {
  try {
    const { keyword } = req.query
    const bookWhere = {}
    if (keyword) {
      bookWhere[Op.or] = [
        { bookTitle: { [Op.like]: `%${keyword}%` } },
        { bookAuthor: { [Op.like]: `%${keyword}%` } },
        { isbn: { [Op.like]: `%${keyword}%` } }
      ]
    }

    const books = await Book.findAll({ where: bookWhere, order: [['id', 'DESC']] })

    const result = []
    for (const b of books) {
      const prodWhere = { status: 'available' }
      if (b.isbn) {
        prodWhere.isbn = b.isbn
      } else {
        prodWhere[Op.or] = [
          { bookTitle: b.bookTitle },
          { title: b.bookTitle }
        ]
      }

      const products = await Product.findAll({
        where: prodWhere,
        attributes: ['id', 'price', 'bookCover'],
        order: [['created_at', 'DESC']]
      })

      if (products.length === 0) {
        result.push({
          id: b.id,
          isbn: b.isbn,
          bookTitle: b.bookTitle,
          bookAuthor: b.bookAuthor,
          bookPublisher: b.bookPublisher,
          edition: b.edition,
          bookCover: b.bookCover,
          minPrice: 0,
          sellerCount: 0
        })
      } else {
        result.push({
          id: b.id,
          isbn: b.isbn,
          bookTitle: b.bookTitle,
          bookAuthor: b.bookAuthor,
          bookPublisher: b.bookPublisher,
          edition: b.edition,
          bookCover: b.bookCover || products[0].bookCover || '',
          minPrice: Math.min(...products.map(p => Number(p.price))),
          sellerCount: products.length
        })
      }
    }

    success(res, result)
  } catch (err) { next(err) }
}

export async function bookDetail(req, res, next) {
  try {
    const key = decodeURIComponent(req.params.key)

    let bookRecord = null
    if (/^\d+$/.test(key)) {
      bookRecord = await Book.findByPk(key)
    }
    if (!bookRecord) {
      bookRecord = await Book.findOne({ where: { [Op.or]: [{ isbn: key }, { bookTitle: key }] } })
    }

    if (!bookRecord) return fail(res, '书籍不存在', 404)

    await bookRecord.update({ viewCount: (bookRecord.viewCount || 0) + 1 })

    const prodWhere = { status: 'available' }
    if (bookRecord.isbn) {
      prodWhere.isbn = bookRecord.isbn
    } else {
      prodWhere[Op.or] = [
        { bookTitle: bookRecord.bookTitle },
        { title: bookRecord.bookTitle }
      ]
    }

    const products = await Product.findAll({
      where: prodWhere,
      order: [['created_at', 'DESC']],
      include: [
        { model: ProductImage, as: 'images' },
        { model: User, as: 'seller', attributes: ['id', 'nickname', 'campus'] }
      ]
    })

    const book = {
      id: bookRecord.id,
      isbn: bookRecord.isbn,
      bookTitle: bookRecord.bookTitle,
      bookAuthor: bookRecord.bookAuthor,
      bookPublisher: bookRecord.bookPublisher,
      edition: bookRecord.edition,
      bookCover: bookRecord.bookCover || (products[0]?.bookCover || ''),
      originalPrice: Number(bookRecord.originalPrice) || 0
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
export async function homeStats(req, res, next) {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [todayBoards, todayBooks] = await Promise.all([
      Book.count({ where: { created_at: { [Op.gte]: todayStart } } }),
      Product.count({ where: { created_at: { [Op.gte]: todayStart } } })
    ])

    const allBooks = await Book.findAll()
    const hotBoards = []
    for (const b of allBooks) {
      const prodWhere = { status: 'available' }
      if (b.isbn) prodWhere.isbn = b.isbn
      else prodWhere[Op.or] = [{ bookTitle: b.bookTitle }, { title: b.bookTitle }]
      const count = await Product.count({ where: prodWhere })
      hotBoards.push({
        id: b.id,
        isbn: b.isbn,
        bookTitle: b.bookTitle,
        bookAuthor: b.bookAuthor,
        bookCover: b.bookCover,
        sellerCount: count,
        viewCount: b.viewCount || 0,
        hotScore: (b.viewCount || 0) + count * 10
      })
    }
    hotBoards.sort((a, b) => b.hotScore - a.hotScore)

    const chartData = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const end = new Date(d)
      end.setDate(end.getDate() + 1)
      const cnt = await Product.count({ where: { created_at: { [Op.gte]: d, [Op.lt]: end } } })
      chartData.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        count: cnt
      })
    }

    success(res, { todayBoards, todayBooks, hotBoards, chartData })
  } catch (err) { next(err) }
}