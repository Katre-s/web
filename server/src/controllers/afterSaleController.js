import { AfterSale, Order, OrderItem, Product, User, Notification } from '../models/index.js'
import { success, fail } from '../utils/response.js'

const STATUS_TEXT = {
  processing: '管理员已接手处理',
  resolved: '售后已处理完成',
  rejected: '售后申请被驳回'
}

/** 后台售后列表 */
export async function listAfterSales(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1)
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 100)
    const { status = '' } = req.query
    const where = {}
    if (status) where.status = status

    const { rows, count } = await AfterSale.findAndCountAll({
      where,
      include: [
        {
          model: Order,
          as: 'order',
          include: [{
            model: OrderItem,
            as: 'items',
            include: [{ model: Product, as: 'product', attributes: ['id', 'title', 'bookTitle', 'bookCover', 'category'] }]
          }]
        },
        { model: User, as: 'buyer', attributes: ['id', 'nickname', 'userNo', 'campus', 'email'] },
        { model: User, as: 'admin', attributes: ['id', 'nickname'] }
      ],
      order: [['id', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      distinct: true
    })
    success(res, { list: rows, total: count })
  } catch (err) { next(err) }
}

/** 管理员处理售后：处理中 / 已解决 / 已驳回 */
export async function handleAfterSale(req, res, next) {
  try {
    const { status, note = '' } = req.body
    if (!['processing', 'resolved', 'rejected'].includes(status)) {
      return fail(res, '无效的售后状态')
    }

    const record = await AfterSale.findByPk(req.params.id)
    if (!record) return fail(res, '售后记录不存在', 404)

    const handled = status !== 'processing'
    await record.update({
      status,
      adminId: req.user.id,
      adminNote: String(note || '').slice(0, 500),
      handledAt: handled ? new Date() : null
    })

    await Order.update(
      { aftersaleStatus: status },
      { where: { id: record.orderId } }
    )

    const suffix = record.adminNote ? `：${record.adminNote}` : ''
    await Notification.create({
      userId: record.buyerId,
      type: 'aftersale',
      content: `订单 #${record.orderId} ${STATUS_TEXT[status]}${suffix}`
    })

    success(res, record.toJSON(), STATUS_TEXT[status])
  } catch (err) { next(err) }
}
