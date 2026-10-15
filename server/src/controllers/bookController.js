import { Op } from 'sequelize'
import { Product } from '../models/index.js'
import { lookupISBN } from '../services/isbnService.js'
import { recognizeImage } from '../services/ocrService.js'
import { parseBookList } from '../services/aiService.js'
import { success, fail } from '../utils/response.js'

export async function isbnLookup(req, res, next) {
  try {
    const { isbn } = req.body
    if (!isbn) return fail(res, '请输入ISBN')

    const result = await lookupISBN(isbn.replace(/[-\s]/g, ''))
    if (!result) return fail(res, '未找到该ISBN对应的书籍信息', 404)

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