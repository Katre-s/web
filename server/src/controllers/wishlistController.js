import { Wishlist, Book, Product, User } from '../models/index.js'
import { Op } from 'sequelize'
import { success, fail } from '../utils/response.js'

export async function add(req, res, next) {
  try {
    const { title, author, isbn } = req.body
    if (!title && !isbn) return fail(res, '请填写书名或ISBN')

    const item = await Wishlist.create({ userId: req.user.id, title, author, isbn })
    success(res, item, '已加入求购清单')
  } catch (err) { next(err) }
}

export async function list(req, res, next) {
  try {
    const items = await Wishlist.findAll({
      where: { userId: req.user.id },
      order: [['created_at', 'DESC']]
    })

    const result = []
    for (const w of items) {
      let book = null
      let sellerCount = 0
      if (w.isbn) {
        book = await Book.findOne({ where: { isbn: w.isbn } })
        if (book) {
          sellerCount = await Product.count({ where: { isbn: w.isbn, status: 'available' } })
        }
      } else if (w.title) {
        book = await Book.findOne({ where: { bookTitle: w.title } })
        if (book) {
          sellerCount = await Product.count({ where: { bookTitle: w.title, status: 'available' } })
        }
      }
      result.push({
        id: w.id,
        title: w.title,
        author: w.author,
        isbn: w.isbn,
        book: book ? {
          id: book.id,
          bookTitle: book.bookTitle,
          bookAuthor: book.bookAuthor,
          bookPublisher: book.bookPublisher,
          edition: book.edition,
          bookCover: book.bookCover,
          isbn: book.isbn
        } : null,
        sellerCount
      })
    }
    success(res, result)
  } catch (err) { next(err) }
}

// 公共求购广场：展示全站买家求购（含关联书籍信息与求购者信息）
export async function listPublic(req, res, next) {
  try {
    const { keyword } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { author: { [Op.like]: `%${keyword}%` } },
        { isbn: { [Op.like]: `%${keyword}%` } }
      ]
    }
    const items = await Wishlist.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 100
    })

    const result = []
    for (const w of items) {
      let book = null
      let sellerCount = 0
      if (w.isbn) {
        book = await Book.findOne({ where: { isbn: w.isbn } })
        if (book) {
          sellerCount = await Product.count({ where: { isbn: w.isbn, status: 'available' } })
        }
      } else if (w.title) {
        book = await Book.findOne({ where: { bookTitle: w.title } })
        if (book) {
          sellerCount = await Product.count({ where: { bookTitle: w.title, status: 'available' } })
        }
      }
      const user = await User.findOne({
        where: { id: w.userId },
        attributes: ['id', 'userNo', 'nickname', 'avatar', 'campus']
      })
      result.push({
        id: w.id,
        title: w.title,
        author: w.author,
        isbn: w.isbn,
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
      })
    }
    success(res, result)
  } catch (err) { next(err) }
}