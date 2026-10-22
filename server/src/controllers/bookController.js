import { Op } from 'sequelize'
import { Product, Book, CartItem } from '../models/index.js'
import { lookupISBN } from '../services/isbnService.js'
import { recognizeImage } from '../services/ocrService.js'
import { parseBookList, scanBookImage } from '../services/aiService.js'
import { downloadImage } from '../utils/imageDownload.js'
import { success, fail } from '../utils/response.js'

async function enrichBookInfo(cleanIsbn) {
  const bookRecord = await Book.findOne({ where: { isbn: cleanIsbn } })
  if (bookRecord) {
    return {
      isbn: cleanIsbn,
      title: bookRecord.bookTitle,
      author: bookRecord.bookAuthor || '',
      publisher: bookRecord.bookPublisher || '',
      cover: bookRecord.bookCover || '',
      edition: bookRecord.edition || '',
      originalPrice: Number(bookRecord.originalPrice) || 0,
      source: 'local'
    }
  }

  const local = await Product.findOne({
    where: { isbn: cleanIsbn },
    order: [['created_at', 'DESC']]
  })
  if (local && local.bookTitle) {
    return {
      isbn: cleanIsbn,
      title: local.bookTitle,
      author: local.bookAuthor || '',
      publisher: local.bookPublisher || '',
      cover: local.bookCover || '',
      edition: local.edition || '',
      originalPrice: local.originalPrice || 0,
      source: 'local'
    }
  }

  const result = await lookupISBN(cleanIsbn)
  if (!result) return null
  if (result.cover) {
    result.cover = await downloadImage(result.cover)
  }
  return { ...result, isbn: cleanIsbn }
}

export async function scanBook(req, res, next) {
  try {
    if (!req.file) return fail(res, '请上传书籍图片')
    const mode = req.body.mode === 'front' ? 'front' : req.body.mode === 'back' ? 'back' : ''

    let info = null
    try { info = await scanBookImage(req.file.path, mode) } catch (err) { console.error(err) }

    // 分模式判定: 正面必须有书名, 背面必须有ISBN, 通用模式有其一即可
    if (mode === 'front') {
      if (!info || !info.title) return fail(res, '未识别到封面书名，请对准书籍封面（正面）拍摄', 422)
    } else if (mode === 'back') {
      const isbnOnly = String(info?.isbn || '').replace(/[-\s]/g, '')
      if (!isbnOnly) return fail(res, '未识别到 ISBN，请对准封底条形码拍摄', 422)
    } else {
      if (!info || (!info.title && !info.isbn)) return fail(res, '未识别到有效的书籍信息，请对准封面或 ISBN 条形码重新拍摄', 422)
    }

    const isbn = String(info.isbn || '').replace(/[-\s]/g, '')
    let enriched = null
    if (/^\d{10,14}$/.test(isbn)) {
      try { enriched = await enrichBookInfo(isbn) } catch (err) { console.error('ISBN补全失败:', err.message) }
    }

    // 市场匹配: 同 ISBN/书名的在售商品数
    let sellingCount = 0
    try {
      if (isbn) {
        sellingCount = await Product.count({ where: { isbn, status: 'available' } })
      } else if (info.title) {
        sellingCount = await Product.count({ where: { bookTitle: info.title, status: 'available' } })
      }
    } catch (err) { console.error('市场匹配统计失败:', err.message) }

    const book = {
      title: enriched?.title || info.title || (isbn ? `ISBN ${isbn}` : ''),
      author: enriched?.author || info.author || '',
      publisher: enriched?.publisher || info.publisher || '',
      edition: enriched?.edition || info.edition || '',
      isbn: enriched?.isbn || isbn,
      cover: `/uploads/${req.file.filename}`, // 识别照片作为封面(需求:可提示更换)
      originalPrice: enriched?.originalPrice || 0,
      source: enriched?.source || 'ai'
    }

    success(res, { book, marketMatches: { sellingCount } }, '识别成功')
  } catch (err) { next(err) }
}

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

    const stats = { cart: 0, created: 0, skipped: 0, unavailable: 0 }
    const cartBooks = []
    const unavailableBooks = []

    for (const raw of isbns) {
      const isbn = String(raw).replace(/[-\s]/g, '')
      if (!isbn || !/^\d{10,14}$/.test(isbn)) { stats.skipped++; continue }

      // 库里没有的图书不再自动创建板块，只用外部接口补个标题用于展示
      const book = await Book.findOne({ where: { isbn } })
      let displayTitle = book?.bookTitle || ''
      if (!book) {
        try {
          const info = await lookupISBN(isbn)
          if (info?.title) displayTitle = info.title
        } catch {}
      }

      const products = await Product.findAll({
        where: { isbn, status: 'available' },
        attributes: ['id', 'price', 'bookTitle']
      })

      if (products.length) {
        // 有在售卖家：拉入购物车
        const existing = await CartItem.findAll({ where: { userId, productId: products.map(p => p.id) } })
        const existingIds = existing.map(e => e.productId)
        const newItems = products.filter(p => !existingIds.includes(p.id))
        if (newItems.length) {
          await CartItem.bulkCreate(newItems.map(p => ({ userId, productId: p.id })))
        }
        stats.cart += newItems.length
        cartBooks.push({ isbn, bookId: book?.id || null, bookTitle: products[0].bookTitle || displayTitle || `ISBN ${isbn}`, sellerCount: products.length })
      } else {
        // 没有的：显示「暂无该物品」
        stats.unavailable++
        unavailableBooks.push({ isbn, bookId: book?.id || null, bookTitle: displayTitle })
      }
    }

    success(res, { stats, cartBooks, unavailableBooks }, `处理完成`)
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