import { Op } from 'sequelize'
import { sequelize, AfterSale, Order, OrderItem, Product, User, Notification, BalanceLog } from '../models/index.js'
import { success, fail } from '../utils/response.js'

const TYPE_TEXT = { refund_only: '仅退款', return_refund: '退货退款' }

/* ---------------- 公共 ---------------- */

/** 退款：优先从卖家待存余额扣，不足部分从账户余额扣；买家收到账户余额 */
async function refundFromEscrow(record, operatorId, note) {
  const amount = Number(record.amount) || 0
  const seller = await User.findByPk(record.sellerId)
  const buyer = await User.findByPk(record.buyerId)
  if (!seller || !buyer) throw new Error('退款对象不存在')

  const pending = Number(seller.pendingBalance) || 0
  const fromPending = Math.min(pending, amount)
  const fromBalance = amount - fromPending

  await sequelize.transaction(async (tx) => {
    if (fromPending > 0) {
      await User.update(
        { pendingBalance: sequelize.literal(`GREATEST(pending_balance - ${fromPending}, 0)`) },
        { where: { id: seller.id }, transaction: tx }
      )
    }
    if (fromBalance > 0) {
      await User.update(
        { balance: sequelize.literal(`GREATEST(balance - ${fromBalance}, 0)`) },
        { where: { id: seller.id }, transaction: tx }
      )
    }
    await BalanceLog.create({
      userId: seller.id,
      type: 'refund_hold',
      amount: -amount,
      balanceAfter: Number(seller.balance) - fromBalance,
      pendingAfter: pending - fromPending,
      orderId: record.orderId,
      note: note || `订单 #${record.orderId} 售后退款（${TYPE_TEXT[record.type] || ''}）`
    }, { transaction: tx })

    await User.update(
      { balance: sequelize.literal(`balance + ${amount}`) },
      { where: { id: buyer.id }, transaction: tx }
    )
    await BalanceLog.create({
      userId: buyer.id,
      type: 'refund',
      amount,
      balanceAfter: Number(buyer.balance) + amount,
      orderId: record.orderId,
      note: `订单 #${record.orderId} 售后退款到账`
    }, { transaction: tx })
  })

  await record.update({ status: 'refunded', refundedAt: new Date(), adminId: operatorId || record.adminId })
  await Order.update({ aftersaleStatus: 'refunded' }, { where: { id: record.orderId } })

  await Notification.create({
    userId: buyer.id,
    type: 'aftersale',
    content: `订单 #${record.orderId} 售后已退款 ¥${amount.toFixed(2)}，已存入你的账户余额`
  })
  await Notification.create({
    userId: seller.id,
    type: 'aftersale',
    content: `订单 #${record.orderId} 售后退款 ¥${amount.toFixed(2)} 已从你的待存余额扣除`
  })
}

/** 每种状态下卖家应看到的动作 */
function sellerActions(record) {
  if (record.status !== 'seller_pending') return []
  if (record.type === 'return_refund') return ['confirm']
  return ['agree', 'reject']
}

async function loadOne(id) {
  return AfterSale.findByPk(id, {
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
      { model: User, as: 'seller', attributes: ['id', 'nickname', 'userNo'] },
      { model: User, as: 'admin', attributes: ['id', 'nickname'] }
    ]
  })
}

/* ---------------- 买家侧 ---------------- */

/** 我发起的售后（订单页已随订单返回，这里给详情用） */
export async function myAfterSales(req, res, next) {
  try {
    const list = await AfterSale.findAll({
      where: { buyerId: req.user.id },
      include: [{ model: Order, as: 'order', include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] }] }],
      order: [['id', 'DESC']]
    })
    success(res, list)
  } catch (err) { next(err) }
}

/** 买家申诉（仅一次，管理员终审） */
export async function appealAfterSale(req, res, next) {
  try {
    const record = await AfterSale.findByPk(req.params.id)
    if (!record) return fail(res, '售后记录不存在', 404)
    if (record.buyerId !== req.user.id) return fail(res, '只能操作自己的售后', 403)
    if (record.status !== 'seller_reject_approved') return fail(res, '当前状态不可申诉')
    if (record.appealed) return fail(res, '申诉机会已使用，无法再次申诉')

    const reason = String(req.body.reason || '').trim().slice(0, 500)
    if (!reason) return fail(res, '请填写申诉理由')

    await record.update({ status: 'appealed', appealed: true, appealReason: reason })
    await Order.update({ aftersaleStatus: 'appealed' }, { where: { id: record.orderId } })
    if (record.sellerId) {
      await Notification.create({
        userId: record.sellerId,
        type: 'aftersale',
        content: `买家对订单 #${record.orderId} 的售后拒绝发起申诉，管理员将进行最终裁定`
      })
    }
    success(res, record.toJSON(), '申诉已提交，等待管理员最终裁定')
  } catch (err) { next(err) }
}

/* ---------------- 卖家侧 ---------------- */

/** 卖家售后列表（个人中心-我的发布-售后处理） */
export async function sellerList(req, res, next) {
  try {
    const list = await AfterSale.findAll({
      where: { sellerId: req.user.id },
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
        { model: User, as: 'buyer', attributes: ['id', 'nickname', 'userNo'] },
        { model: User, as: 'admin', attributes: ['id', 'nickname'] }
      ],
      order: [['id', 'DESC']]
    })
    success(res, list.map(r => ({ ...r.toJSON(), actions: sellerActions(r) })))
  } catch (err) { next(err) }
}

/** 卖家处理售后 */
export async function sellerHandle(req, res, next) {
  try {
    const record = await AfterSale.findByPk(req.params.id)
    if (!record) return fail(res, '售后记录不存在', 404)
    if (record.sellerId !== req.user.id) return fail(res, '只能处理自己卖出的售后', 403)
    if (record.status !== 'seller_pending') return fail(res, '当前状态无需卖家处理')

    const action = req.body.action
    if (record.type === 'return_refund') {
      if (action !== 'confirm') return fail(res, '退货退款请在收到退货后确认收货并退款')
      await refundFromEscrow(record, null, `订单 #${record.orderId} 卖家确认收货并退款`)
      return success(res, {}, '已确认退货并退款')
    }

    // 仅退款：同意 / 拒绝（拒绝必须写原因，转管理员审核）
    if (action === 'agree') {
      await refundFromEscrow(record, null, `订单 #${record.orderId} 卖家同意仅退款`)
      return success(res, {}, '已同意退款')
    }
    if (action === 'reject') {
      const reason = String(req.body.reason || '').trim().slice(0, 500)
      if (!reason) return fail(res, '拒绝退款时请写明原因，将由管理员审核')
      await record.update({ status: 'seller_rejected', rejectReason: reason })
      await Order.update({ aftersaleStatus: 'seller_rejected' }, { where: { id: record.orderId } })
      await Notification.create({
        userId: record.buyerId,
        type: 'aftersale',
        content: `卖家拒绝了订单 #${record.orderId} 的退款申请（原因：${reason}），管理员将进行审核`
      })
      return success(res, record.toJSON(), '已提交拒绝原因，等待管理员审核')
    }
    return fail(res, '无效的操作')
  } catch (err) { next(err) }
}

/* ---------------- 管理员侧 ---------------- */

/** 后台售后列表（可按状态筛选） */
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
        { model: User, as: 'seller', attributes: ['id', 'nickname', 'userNo'] },
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

/** 管理员审核买家申请：同意（转卖家处理）/ 驳回 */
export async function reviewAfterSale(req, res, next) {
  try {
    const record = await AfterSale.findByPk(req.params.id)
    if (!record) return fail(res, '售后记录不存在', 404)
    if (record.status !== 'pending') return fail(res, '该售后已不在待审核状态')

    const { action, note = '' } = req.body
    const adminNote = String(note || '').slice(0, 500)

    if (action === 'approve') {
      await record.update({ status: 'seller_pending', adminId: req.user.id, adminNote, handledAt: new Date() })
      await Order.update({ aftersaleStatus: 'seller_pending' }, { where: { id: record.orderId } })
      if (record.sellerId) {
        const tip = record.type === 'return_refund'
          ? `买家对订单 #${record.orderId} 的退货退款申请已通过管理员审核，请留意退货并在卖家中心「确认收货并退款」`
          : `买家对订单 #${record.orderId} 的仅退款申请已通过管理员审核，请在卖家中心处理（同意或拒绝）`
        await Notification.create({ userId: record.sellerId, type: 'aftersale', content: tip })
      }
      await Notification.create({
        userId: record.buyerId,
        type: 'aftersale',
        content: `订单 #${record.orderId} 的${TYPE_TEXT[record.type]}申请已通过审核，等待卖家处理${adminNote ? `（备注：${adminNote}）` : ''}`
      })
      return success(res, record.toJSON(), '已通过，转卖家处理')
    }

    if (action === 'reject') {
      await record.update({ status: 'rejected', adminId: req.user.id, adminNote, handledAt: new Date() })
      await Order.update({ aftersaleStatus: 'rejected' }, { where: { id: record.orderId } })
      await Notification.create({
        userId: record.buyerId,
        type: 'aftersale',
        content: `订单 #${record.orderId} 的售后申请被管理员驳回${adminNote ? `：${adminNote}` : ''}`
      })
      return success(res, record.toJSON(), '已驳回')
    }

    return fail(res, '无效的操作')
  } catch (err) { next(err) }
}

/** 管理员审核卖家的拒绝：同意拒绝（买家可申诉一次）/ 驳回拒绝（直接退款给买家） */
export async function reviewSellerReject(req, res, next) {
  try {
    const record = await AfterSale.findByPk(req.params.id)
    if (!record) return fail(res, '售后记录不存在', 404)
    if (record.status !== 'seller_rejected') return fail(res, '该售后不在卖家拒绝待审核状态')

    const { action, note = '' } = req.body
    const adminNote = String(note || '').slice(0, 500)

    if (action === 'approve') {
      // 管理员认可卖家拒绝：买家保留最后一次申诉机会
      await record.update({ status: 'seller_reject_approved', adminId: req.user.id, adminNote, handledAt: new Date() })
      await Order.update({ aftersaleStatus: 'seller_reject_approved' }, { where: { id: record.orderId } })
      await Notification.create({
        userId: record.buyerId,
        type: 'aftersale',
        content: `管理员已同意卖家拒绝订单 #${record.orderId} 的退款${adminNote ? `：${adminNote}` : ''}，你可在订单页发起最后一次申诉`
      })
      return success(res, record.toJSON(), '已同意卖家拒绝，买家可申诉一次')
    }

    if (action === 'reject') {
      // 不认可卖家拒绝：直接退款
      await refundFromEscrow(record, req.user.id, `订单 #${record.orderId} 管理员裁定退款（卖家拒绝不成立）`)
      await record.update({ adminNote, handledAt: new Date() })
      return success(res, record.toJSON(), '已裁定退款给买家')
    }

    return fail(res, '无效的操作')
  } catch (err) { next(err) }
}

/** 管理员申诉终审：同意申诉（退款，终局）/ 驳回申诉（终局，买家不可再申诉） */
export async function reviewAppeal(req, res, next) {
  try {
    const record = await AfterSale.findByPk(req.params.id)
    if (!record) return fail(res, '售后记录不存在', 404)
    if (record.status !== 'appealed') return fail(res, '该售后不在申诉状态')

    const { action, note = '' } = req.body
    const adminNote = String(note || '').slice(0, 500)

    if (action === 'approve') {
      await refundFromEscrow(record, req.user.id, `订单 #${record.orderId} 申诉终审通过，退款给买家`)
      await record.update({ adminNote, handledAt: new Date() })
      await Notification.create({
        userId: record.sellerId,
        type: 'aftersale',
        content: `订单 #${record.orderId} 买家申诉已通过管理员终审，退款已执行，此裁定为最终结果`
      })
      return success(res, record.toJSON(), '申诉通过，已退款（终局）')
    }

    if (action === 'reject') {
      await record.update({ status: 'closed', adminId: req.user.id, adminNote, handledAt: new Date() })
      await Order.update({ aftersaleStatus: 'closed' }, { where: { id: record.orderId } })
      await Notification.create({
        userId: record.buyerId,
        type: 'aftersale',
        content: `订单 #${record.orderId} 的申诉被管理员驳回${adminNote ? `：${adminNote}` : ''}，此裁定为最终结果`
      })
      return success(res, record.toJSON(), '申诉已驳回（终局）')
    }

    return fail(res, '无效的操作')
  } catch (err) { next(err) }
}
