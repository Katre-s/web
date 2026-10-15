import { Op } from 'sequelize'
import { Product, ProductImage, User, Favorite } from '../models/index.js'
import { success, fail } from '../utils/response.js'

const orderMap = {
  newest: [['created_at', 'DESC']],
  price_asc: [['price', 'ASC']],
  price_desc: [['price', 'DESC']]
}

export async function list(req, res, next) {
  try {
    const { keyword, category, sort = 'newest', page = 1, pageSize = 20 } = req.query
    const where = { status: 'available' }
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { bookTitle: { [Op.like]: `%${keyword}%` } },
        { bookAuthor: { [Op.like]: `%${keyword}%` } },
        { isbn: { [Op.like]: `%${keyword}%` } }
      ]
    }
    if (category) where.category = category

    const { rows, count } = await Product.findAndCountAll({
      where,
      order: orderMap[sort] || orderMap.newest,
      offset: (page - 1) * pageSize,
      limit: Number(pageSize),
      include: [{ model: ProductImage, as: 'images' }]
    })
    success(res, rows, `共${count}条`)
  } catch (err) { next(err) }
}

export async function detail(req, res, next) {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: ProductImage, as: 'images' }, { model: User, as: 'seller' }]
    })
    if (!product) return fail(res, '商品不存在', 404)
    success(res, product)
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const userId = req.user.id
    const { isbn, bookTitle, bookAuthor, bookPublisher, bookCover, originalPrice,
            price, condition, category, description } = req.body
    const title = bookTitle || req.body.title || '未命名书籍'

    const product = await Product.create({
      userId, title, isbn, bookTitle, bookAuthor, bookPublisher, bookCover,
      originalPrice: originalPrice || 0, price, condition, category, description,
      status: 'available'
    })

    if (req.files && req.files.length) {
      await ProductImage.bulkCreate(
        req.files.map((f, i) => ({
          productId: product.id,
          imagePath: `/uploads/${f.filename}`,
          sortOrder: i
        }))
      )
    }
    success(res, product, '发布成功')
  } catch (err) { next(err) }
}

export async function update(req, res, next) {
  try {
    const product = await Product.findByPk(req.params.id)
    if (!product) return fail(res, '商品不存在', 404)
    if (product.userId !== req.user.id) return fail(res, '无权操作', 403)
    await product.update(req.body)
    success(res, product, '更新成功')
  } catch (err) { next(err) }
}

export async function remove(req, res, next) {
  try {
    const product = await Product.findByPk(req.params.id)
    if (!product) return fail(res, '商品不存在', 404)
    if (product.userId !== req.user.id) return fail(res, '无权操作', 403)
    await product.destroy()
    success(res, null, '删除成功')
  } catch (err) { next(err) }
}

export async function myProducts(req, res, next) {
  try {
    const products = await Product.findAll({
      where: { userId: req.user.id },
      order: [['created_at', 'DESC']],
      include: [{ model: ProductImage, as: 'images' }]
    })
    success(res, products)
  } catch (err) { next(err) }
}