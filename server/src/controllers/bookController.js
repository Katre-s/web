import { Op } from 'sequelize'
import { Product, Book, CartItem, Wishlist } from '../models/index.js'
import { lookupISBN } from '../services/isbnService.js'
import { recognizeImage } from '../services/ocrService.js'
import { parseBookList } from '../services/aiService.js'
import { downloadImage } from '../utils/imageDownload.js'
import { success, fail } from '../utils/response.js'

export async function isbnLookup(req, res, next) {
  try {
    const { isbn } = req.body
    if (!isbn) return fail(res, '请输入ISBN')

    const cleanIsbn = isbn.replace(/[-\s]/g, '')

    const bookRecord = await Book.findOne({ where: { isbn: cleanIsbn } })
    if (bookRecord) {
      return success(res, {
        isbn: cleanIsbn,
        title: bookRecord.bookTitle,
        author: bookRecord.bookAuthor || '',
        publisher: bookRecord.bookPublisher || '',
        cover: bookRecord.bookCover || '',
        edition: bookRecord.edition || '',
        originalPrice: Number(bookRecord.originalPrice) || 0,
        source: 'local'
      }, '识别成功（本地图书库）')
    }

    const local = await Product.findOne({
      where: { isbn: cleanIsbn },
      order: [['created_at', 'DESC']]
    })
    if (local && local.bookTitle) {
      return success(res, {
        isbn: cleanIsbn,
        title: local.bookTitle,
        author: local.bookAuthor || '',
        publisher: local.bookPublisher || '',
        cover: local.bookCover || '',
        edition: local.edition || '',
        originalPrice: local.originalPrice || 0,
        source: 'local'
      }, '识别成功（本地图书库）')
    }

    const result = await lookupISBN(cleanIsbn)
    if (!result) return fail(res, '未找到该ISBN对应的书籍信息，请手动填写', 404)

    if (result.cover) {
      result.cover = await downloadImage(result.cover)
    }

    success(res, result, '识别成功')
  } catch (err) { next(err) }
}

export async function parseList(req, res, next) {
  try {
    let text = req.body.text || ''
    if (req.file) {
      text = await recognizeImage(req.file.path)
      if (!text) return fail(res, 'OCR识别失败，请检查百度OCR配置或改用文本输入')
    }
    if (!text) return fail(res, '请上传图片或粘贴文本')

    const books = await parseBookList(text)
    success(res, { books, rawText: text }, `解析出${books.length}本书`)
  } catch (err) { next(err) }
}

export async function processBookList(req, res, next) {
  try {
    const { isbns } = req.body
    const userId = req.user.id
    if (!isbns || !isbns.length) return fail(res, '请提供ISBN列表')

    const stats = { cart: 0, wishlist: 0, created: 0, skipped: 0 }
    const cartBooks = []
    const wishlistBooks = []

    for (const raw of isbns) {
      const isbn = String(raw).replace(/[-\s]/g, '')
      if (!isbn || !/^\d{10,14}$/.test(isbn)) { stats.skipped++; continue }

      let book = await Book.findOne({ where: { isbn } })
      if (!book) {
        let info = null
        try { info = await lookupISBN(isbn) } catch {}
        if (info?.cover) {
          try { info.cover = await downloadImage(info.cover) } catch {}
        }
        book = await Book.create({
          isbn,
          bookTitle: info?.title || '未知书名',
          bookAuthor: info?.author || '未知',
          bookPublisher: info?.publisher || '未知',
          edition: info?.edition || '未知',
          bookCover: info?.cover || '',
          originalPrice: info?.originalPrice || 0,
          createdBy: userId
        })
        stats.created++
      }

      const products = await Product.findAll({
        where: { isbn, status: 'available' },
        attributes: ['id', 'price', 'bookTitle']
      })

      if (products.length) {
        const existing = await CartItem.findAll({ where: { userId, productId: products.map(p => p.id) } })
        const existingIds = existing.map(e => e.productId)
        const newItems = products.filter(p => !existingIds.includes(p.id))
        if (newItems.length) {
          await CartItem.bulkCreate(newItems.map(p => ({ userId, productId: p.id })))
        }
        stats.cart += newItems.length
        cartBooks.push({ isbn, bookId: book.id, bookTitle: book.bookTitle, sellerCount: products.length })
      } else {
        const wExists = await Wishlist.findOne({ where: { userId, isbn } })
        if (!wExists) {
          await Wishlist.create({ userId, title: book.bookTitle, isbn })
          stats.wishlist++
        } else {
          stats.wishlist++
        }
        wishlistBooks.push({ isbn, bookId: book.id, bookTitle: book.bookTitle })
      }
    }

    success(res, { stats, cartBooks, wishlistBooks }, `处理完成`)
  } catch (err) { next(err) }
}

export async function match(req, res, next) {
  try {
    const { bookList } = req.body
    if (!bookList || !bookList.length) return fail(res, '书单为空')

    const matched = []
    const unmatched = []

    for (const book of bookList) {
      const where = { status: 'available' }
      const orCond = []
      if (book.isbn) orCond.push({ isbn: book.isbn })
      if (book.title) orCond.push({ bookTitle: { [Op.like]: `%${book.title}%` } })
      if (book.title) orCond.push({ title: { [Op.like]: `%${book.title}%` } })
      if (orCond.length) where[Op.or] = orCond

      const products = await Product.findAll({ where, limit: 5 })
      if (products.length) {
        matched.push(...products.map(p => p.toJSON()))
      } else {
        unmatched.push(book)
      }
    }

    success(res, { matched, unmatched }, `匹配${matched.length}本，未匹配${unmatched.length}本`)
  } catch (err) { next(err) }
}