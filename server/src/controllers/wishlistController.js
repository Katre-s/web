import { Wishlist, Book, Product, User, sequelize } from '../models/index.js'
import { Op } from 'sequelize'
import { success, fail } from '../utils/response.js'

// 批量补全求购条目的书籍与在售数信息，避免逐条查询(N+1)
async function enrichWishlist(items, { withUser = false } = {}) {
  if (!items.length) return []

  const isbns = [...new Set(items.map(w => w.isbn).filter(Boolean))]
  const titles = [...new Set(items.map(w => w.title).filter(Boolean))]

  const bookWhere = []
  if (isbns.length) bookWhere.push({ isbn: isbns })
  if (titles.length) bookWhere.push({ bookTitle: titles })
  const books = bookWhere.length
    ? await Book.findAll({ where: { [Op.or]: bookWhere } })
    : []

  const bookByIsbn = new Map()
  const bookByTitle = new Map()
  for (const b of books) {
    if (b.isbn) bookByIsbn.set(b.isbn, b)
    if (b.bookTitle) bookByTitle.set(b.bookTitle, b)
  }

  // 在售数按 ISBN / 书名各做一次分组统计
  const countBy = new Map()
  const countQueries = []
  if (isbns.length) {
    countQueries.push(
      Product.findAll({
        attributes: ['isbn', [sequelize.fn('COUNT', sequelize.col('id')), 'cnt']],
        where: { status: 'available', isbn: isbns },
        group: ['isbn'],
        raw: true
      }).then(rows => rows.forEach(r => countBy.set(`isbn:${r.isbn}`, Number(r.cnt))))
    )
  }
  if (titles.length) {
    countQueries.push(
      Product.findAll({
        attributes: ['book_title', [sequelize.fn('COUNT', sequelize.col('id')), 'cnt']],
        where: { status: 'available', bookTitle: titles },
        group: ['book_title'],
        raw: true
      }).then(rows => rows.forEach(r => countBy.set(`title:${r.book_title}`, Number(r.cnt))))
    )
  }
  await Promise.all(countQueries)

  // 求购者信息批量查询
  let userMap = new Map()
  if (withUser) {
    const userIds = [...new Set(items.map(w => w.userId).filter(Boolean))]
    if (userIds.length) {
      const users = await User.findAll({
        where: { id: userIds },
        attributes: ['id', 'userNo', 'nickname', 'avatar', 'campus']
      })
      userMap = new Map(users.map(u => [u.id, u]))
    }
  }

  return items.map(w => {
    const book = (w.isbn && bookByIsbn.get(w.isbn)) || (w.title && bookByTitle.get(w.title)) || null
    const sellerCount = book
      ? (w.isbn ? countBy.get(`isbn:${w.isbn}`) : 0) || (w.title ? countBy.get(`title:${w.title}`) : 0) || 0
      : 0
    const user = withUser ? userMap.get(w.userId) : null
    return {
      id: w.id,
      title: w.title,
      author: w.author,
      isbn: w.isbn,
      cover: w.cover || '',
      createdAt: w.created_at,
      book: book ? {
        id: book.id,
        bookTitle: book.bookTitle,
        bookAuthor: book.bookAuthor,
        bookPublisher: book.bookPublisher,
        edition: book.edition,
        bookCover: book.bookCover,
        isbn: book.isbn
      } : null,
      sellerCount,
      user: user ? {
        id: user.id,
        userNo: user.userNo,
        nickname: user.nickname,
        avatar: user.avatar,
        campus: user.campus
      } : null
    }
  })
}

export async function add(req, res, next) {
  try {
    const { title, author, isbn, cover } = req.body
    if (!title && !isbn) return fail(res, '请填写书名或ISBN')

    const item = await Wishlist.create({ userId: req.user.id, title, author, isbn, cover: cover || '' })
    success(res, item, '已加入求购清单')
  } catch (err) { next(err) }
}

export async function list(req, res, next) {
  try {
    const items = await Wishlist.findAll({
      where: { userId: req.user.id },
      order: [['created_at', 'DESC']]
    })
    success(res, await enrichWishlist(items))
  } catch (err) { next(err) }
}

// 公共求购广场：展示全站买家求购（含关联书籍信息与求购者信息）
export async function listPublic(req, res, next) {
  try {
    const { keyword, field, isbn } = req.query
    const where = {}
    if (isbn) {
      where.isbn = String(isbn).replace(/[-\s]/g, '')
    } else if (keyword) {
      if (field === 'author') {
        where.author = { [Op.like]: `%${keyword}%` }
      } else if (field === 'isbn') {
        where.isbn = { [Op.like]: `%${keyword}%` }
      } else {
        where[Op.or] = [
          { title: { [Op.like]: `%${keyword}%` } },
          { author: { [Op.like]: `%${keyword}%` } },
          { isbn: { [Op.like]: `%${keyword}%` } }
        ]
      }
    }
    const items = await Wishlist.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 100
    })
    success(res, await enrichWishlist(items, { withUser: true }))
  } catch (err) { next(err) }
}
