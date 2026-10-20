import dotenv from 'dotenv'
import { sequelize, Book, Product } from '../models/index.js'
import { lookupByGoogleBooks } from '../services/isbnService.js'

dotenv.config()

function hasChinese(str) {
  return /[\u4e00-\u9fff]/.test(str || '')
}

// 重查并修复已存英文的书籍元数据(作者/出版社)
async function fixTable(Model, name) {
  const rows = await Model.findAll()
  let fixed = 0
  for (const row of rows) {
    const isbn = (row.isbn || '').replace(/[-\s]/g, '')
    if (!isbn || !/^\d{10,14}$/.test(isbn)) continue

    const authorOk = hasChinese(row.bookAuthor)
    const publisherOk = hasChinese(row.bookPublisher)
    if (authorOk && publisherOk) continue
    if (!row.bookAuthor && !row.bookPublisher) continue

    let info = null
    try { info = await lookupByGoogleBooks(isbn, { country: 'CN' }) } catch {}
    if (!info) continue

    const updates = {}
    if (!authorOk && hasChinese(info.author)) updates.bookAuthor = info.author
    if (!publisherOk && hasChinese(info.publisher)) updates.bookPublisher = info.publisher

    if (Object.keys(updates).length) {
      await row.update(updates)
      fixed++
      console.log(`[${name}] #${row.id} ${row.bookTitle}:`, updates)
    }
  }
  console.log(`[${name}] 共修复 ${fixed} 条记录`)
}

async function main() {
  await sequelize.authenticate()
  console.log('数据库连接成功，开始修复英文书籍元数据...')
  await fixTable(Book, 'books')
  await fixTable(Product, 'products')
  console.log('修复完成')
  process.exit(0)
}

main().catch(err => {
  console.error('修复失败:', err.message)
  process.exit(1)
})
