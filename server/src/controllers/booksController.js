import { Op } from 'sequelize'
import { sequelize } from '../models/index.js'
import { Product, ProductImage, User, Book } from '../models/index.js'
import { success, fail } from '../utils/response.js'

const { fn, col } = sequelize

/**
 * 批量统计「按 ISBN / 按书名」的在售数与最低价。
 * 之前是逐本书 Product.findAll + count，书一多就是典型的 N+1（几十次往返 DB），
 * 首页 / 交易页发卡主要来自这里。
 */
async function buildProductStats(books) {
  const isbns = [...new Set(books.map((b) => b.isbn).filter(Boolean))]
  const titles = [...new Set(books.map((b) => b.bookTitle).filter(Boolean))]
  const byIsbn = new Map()
  const byTitle = new Map()
  const tasks = []

  if (isbns.length) {
    tasks.push(
      Product.findAll({
        attributes: ['isbn', [fn('COUNT', col('id')), 'cnt'], [fn('MIN', col('price')), 'minPrice']],
        where: { isbn: isbns, status: 'available' },
        group: ['isbn'],
        raw: true
      }).then((rows) => rows.forEach((r) => byIsbn.set(r.isbn, { count: Number(r.cnt), minPrice: Number(r.minPrice) })))
    )
  }
  if (titles.length) {
    tasks.push(
      Product.findAll({
        attributes: ['book_title', [fn('COUNT', col('id')), 'cnt'], [fn('MIN', col('price')), 'minPrice']],
        where: { bookTitle: titles, status: 'available' },
        group: ['book_title'],
        raw: true
      }).then((rows) => rows.forEach((r) => byTitle.set(r.book_title, { count: Number(r.cnt), minPrice: Number(r.minPrice) })))
    )
  }
  await Promise.all(tasks)

  // 板块自身没有封面时，用最新一个在售商品的封面兜底（同样批量取）
  const needsCover = books.filter((b) => !b.bookCover)
  const coverByIsbn = new Map()
  const coverByTitle = new Map()
  if (needsCover.length) {
    const ncIsbns = needsCover.map((b) => b.isbn).filter(Boolean)
    const ncTitles = needsCover.map((b) => b.bookTitle).filter(Boolean)
    const ors = []
    if (ncIsbns.length) ors.push({ isbn: ncIsbns })
    if (ncTitles.length) ors.push({ bookTitle: ncTitles })
    if (ors.length) {
      const rows = await Product.findAll({
        where: { status: 'available', [Op.or]: ors },
        attributes: ['isbn', 'bookTitle', 'bookCover'],
        order: [['created_at', 'DESC']],
        raw: true
      })
      for (const r of rows) {
        if (r.isbn && !coverByIsbn.has(r.isbn)) coverByIsbn.set(r.isbn, r.bookCover)
        if (r.bookTitle && !coverByTitle.has(r.bookTitle)) coverByTitle.set(r.bookTitle, r.bookCover)
      }
    }
  }

  return (book) => {
    const stat = (book.isbn && byIsbn.get(book.isbn)) || (book.bookTitle && byTitle.get(book.bookTitle)) || null
    const cover = book.bookCover
      || (book.isbn && coverByIsbn.get(book.isbn))
      || (book.bookTitle && coverByTitle.get(book.bookTitle))
      || ''
    return {
      sellerCount: stat ? stat.count : 0,
      minPrice: stat ? stat.minPrice : 0,
      cover
    }
  }
}

export async function listBooks(req, res, next) {
  try {
    const { keyword, isbn, field, minPrice, maxPrice } = req.query
    const bookWhere = {}
    if (keyword) {
      if (field === 'author') {
        bookWhere.bookAuthor = { [Op.like]: `%${keyword}%` }
      } else if (field === 'isbn') {
        bookWhere.isbn = { [Op.like]: `%${keyword}%` }
      } else {
        bookWhere[Op.or] = [
          { bookTitle: { [Op.like]: `%${keyword}%` } },
          { bookAuthor: { [Op.like]: `%${keyword}%` } },
          { isbn: { [Op.like]: `%${keyword}%` } }
        ]
      }
    }

    let books = []
    if (isbn) {
      // 精确 ISBN 筛选: 优先查 Book 表, 无记录时从在售商品聚合
      const cleanIsbn = String(isbn).replace(/[-\s]/g, '')
      books = await Book.findAll({ where: { isbn: cleanIsbn } })
      if (books.length === 0) {
        const prod = await Product.findOne({
          where: { isbn: cleanIsbn, status: 'available' },
          order: [['created_at', 'DESC']]
        })
        if (prod) {
          books = [{
            id: null,
            isbn: prod.isbn || cleanIsbn,
            bookTitle: prod.bookTitle || prod.title || '未知书目',
            bookAuthor: prod.bookAuthor || '',
            bookPublisher: prod.bookPublisher || '',
            edition: prod.edition || '',
            bookCover: prod.bookCover || ''
          }]
        }
      }
    } else {
      books = await Book.findAll({ where: bookWhere, order: [['id', 'DESC']] })
    }

    const statOf = await buildProductStats(books)
    let result = books.map((b) => {
      const stat = statOf(b)
      return {
        id: b.id,
        isbn: b.isbn,
        bookTitle: b.bookTitle,
        bookAuthor: b.bookAuthor,
        bookPublisher: b.bookPublisher,
        edition: b.edition,
        bookCover: stat.cover,
        minPrice: stat.minPrice,
        sellerCount: stat.sellerCount
      }
    })

    // 价格区间过滤(基于最低售价)
    const lo = minPrice !== undefined && minPrice !== '' ? Number(minPrice) : NaN
    const hi = maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : NaN
    if (!isNaN(lo) || !isNaN(hi)) {
      result = result.filter((r) => {
        const p = Number(r.minPrice) || 0
        if (!isNaN(lo) && p < lo) return false
        if (!isNaN(hi) && p > hi) return false
        return true
      })
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
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - 6)

    const [todayBoards, todayBooks, allBooks] = await Promise.all([
      Book.count({ where: { created_at: { [Op.gte]: todayStart } } }),
      Product.count({ where: { created_at: { [Op.gte]: todayStart } } }),
      Book.findAll()
    ])

    // 热榜：一次批量统计，替代逐本 Product.count
    const statOf = await buildProductStats(allBooks)
    const hotBoards = allBooks.map((b) => {
      const stat = statOf(b)
      return {
        id: b.id,
        isbn: b.isbn,
        bookTitle: b.bookTitle,
        bookAuthor: b.bookAuthor,
        bookCover: stat.cover || b.bookCover,
        sellerCount: stat.sellerCount,
        viewCount: b.viewCount || 0,
        hotScore: (b.viewCount || 0) + stat.sellerCount * 10
      }
    }).sort((a, b) => b.hotScore - a.hotScore)

    // 近 7 日上架趋势：一条 GROUP BY 替代 7 次 count
    const dayRows = await Product.findAll({
      attributes: [[fn('DATE', col('created_at')), 'day'], [fn('COUNT', col('id')), 'cnt']],
      where: { created_at: { [Op.gte]: weekStart } },
      group: [fn('DATE', col('created_at'))],
      raw: true
    })
    const dayMap = new Map(dayRows.map((r) => {
      const key = r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day)
      return [key, Number(r.cnt)]
    }))

    const chartData = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart)
      d.setDate(d.getDate() - i)
      const pad = (n) => String(n).padStart(2, '0')
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      chartData.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        count: dayMap.get(key) || 0
      })
    }

    success(res, { todayBoards, todayBooks, hotBoards, chartData })
  } catch (err) { next(err) }
}
