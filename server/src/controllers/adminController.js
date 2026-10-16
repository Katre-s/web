import { Op } from 'sequelize'
import { User, Product, Order, Hotspot, ProductImage } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export async function stats(req, res, next) {
  try {
    const [userCount, productCount, orderCount, hotspotCount, bannedCount] = await Promise.all([
      User.count(),
      Product.count(),
      Order.count(),
      Hotspot.count({ where: { status: 'active' } }),
      User.count({ where: { status: 'banned' } })
    ])
    const recentUsers = await User.findAll({ order: [['id', 'DESC']], limit: 5, attributes: ['id', 'email', 'nickname', 'campus', 'role', 'status', ['created_at', 'created_at']] })
    success(res, { userCount, productCount, orderCount, hotspotCount, bannedCount, recentUsers })
  } catch (err) { next(err) }
}

export async function users(req, res, next) {
  try {
    const { keyword = '', page = 1, pageSize = 20 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { email: { [Op.like]: `%${keyword}%` } },
        { nickname: { [Op.like]: `%${keyword}%` } },
        { realName: { [Op.like]: `%${keyword}%` } }
      ]
    }
    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: ['id', 'email', 'nickname', 'realName', 'campus', 'role', 'status', ['created_at', 'created_at']],
      order: [['id', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: Number(pageSize)
    })
    success(res, { list: rows, total: count })
  } catch (err) { next(err) }
}

export async function updateUser(req, res, next) {
  try {
    const { id } = req.params
    const { status, role } = req.body
    const user = await User.findByPk(id)
    if (!user) return fail(res, '用户不存在', 404)
    if (Number(id) === req.user.id && status === 'banned') {
      return fail(res, '不能封禁自己')
    }
    if (status) user.status = status
    if (role) user.role = role
    await user.save()
    success(res, null, '操作成功')
  } catch (err) { next(err) }
}

export async function createBook(req, res, next) {
  try {
    const { title, bookTitle, bookAuthor, bookPublisher, edition, description, price, originalPrice, category, isbn } = req.body
    if (!bookTitle && !title) return fail(res, '请输入书名')
    if (!bookAuthor) return fail(res, '请输入作者')
    if (!price) return fail(res, '请输入建议价格')

    const finalTitle = bookTitle || title
    const product = await Product.create({
      userId: req.user.id,
      title: finalTitle,
      bookTitle: finalTitle,
      bookAuthor,
      bookPublisher: bookPublisher || '',
      edition: edition || '',
      description: description || '',
      price,
      originalPrice: originalPrice || price,
      category: category || '其他',
      isbn: isbn || '',
      condition: '全新',
      delivery: true,
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
    success(res, product, '新书上架成功')
  } catch (err) { next(err) }
}

export async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findByPk(req.params.id)
    if (!product) return fail(res, '商品不存在', 404)
    await product.destroy()
    success(res, null, '商品已删除')
  } catch (err) { next(err) }
}