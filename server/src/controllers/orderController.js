import { Op } from 'sequelize'
import { sequelize } from '../config/database.js'
import { CartItem, Product, Order, OrderItem, User, Conversation, ChatMessage, Notification, BalanceLog, AfterSale, Book } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 事务锁等待/死锁自动重试：线上偶发并发时避免直接 500
async function withRetry(fn, tries = 3, baseDelay = 1000) {
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn()
    } catch (err) {
      const msg = String(err?.message || err)
      const retryable = msg.includes('Lock wait timeout') || msg.includes('Deadlock') || msg.includes('deadlock')
      if (retryable && i < tries) {
        await new Promise((r) => setTimeout(r, baseDelay * i))
        continue
      }
      throw err
    }
  }
}

// 下单：只占商品（标记 sold）+ 建订单，不动余额；确认收货时才扣款入账
export async function create(req, res, next) {
  try {
    const { cartItemIds } = req.body
    if (!cartItemIds || !cartItemIds.length) return fail(res, '请选择要下单的商品')

    const cartItems = await CartItem.findAll({
      where: { id: cartItemIds, userId: req.user.id },
      include: [{ model: Product, as: 'product' }]
    })
    if (!cartItems.length) return fail(res, '购物车商品不存在')

    const availableItems = cartItems.filter(i => i.product && i.product.status === 'available')
    if (!availableItems.length) return fail(res, '所选商品已售出')

    const totalPrice = availableItems.reduce((sum, i) => sum + Number(i.product.price), 0)

    // 余额预检：确认收货时才真正扣款，这里提前提示避免下单后才发现付不起
    const buyer = await User.findByPk(req.user.id)
    if (Number(buyer.balance) < totalPrice) {
      return fail(res, `余额不足，当前余额 ¥${Number(buyer.balance).toFixed(2)}，本单需 ¥${totalPrice.toFixed(2)}，请先充值`)
    }

    // 顺序关键：必须先 Product.update（拿商品行 X 锁），再建明细（外键检查只取 S 锁，自己持有 X 兼容），
    // 反之则明细插入时 FK 检查对商品行加 S 锁（事务结束才释放），同事务再 UPDATE 需 X 锁 → MySQL5.7 Lock wait timeout
    const order = await withRetry(() => sequelize.transaction(async (tx) => {
      await Product.update({ status: 'sold' }, { where: { id: availableItems.map(i => i.productId) } }, { transaction: tx })
      // 非图书类目：商品卖完后自动删除其书目板块（图书板块保留）
      try {
        const soldItems = await Product.findAll({
          where: { id: availableItems.map(i => i.productId), category: { [Op.ne]: '图书' } },
          attributes: ['id', 'isbn', 'bookTitle', 'title']
        })
        for (const sp of soldItems) {
          const conds = []
          if (sp.isbn) conds.push({ isbn: sp.isbn })
          const name = sp.bookTitle || sp.title
          if (name) conds.push({ bookTitle: name })
          if (!conds.length) continue
          const boards = await Book.findAll({ where: { [Op.or]: conds } })
          for (const board of boards) {
            const aliveCond = board.isbn
              ? { isbn: board.isbn, status: 'available' }
              : { [Op.or]: [{ bookTitle: board.bookTitle }, { title: board.bookTitle }], status: 'available' }
            const alive = await Product.count({ where: aliveCond })
            if (alive === 0) await board.destroy()
          }
        }
      } catch (err) {
        console.error('[板块清理] 失败:', err.message)
      }

      const newOrder = await Order.create({ buyerId: req.user.id, totalPrice, status: 'pending' }, { transaction: tx })
      await OrderItem.bulkCreate(availableItems.map(i => ({
        orderId: newOrder.id,
        productId: i.productId,
        sellerId: i.product.userId,
        price: i.product.price
      })), { transaction: tx })

      await CartItem.destroy({ where: { id: cartItemIds } }, { transaction: tx })
      return newOrder
    }))

    // 通知卖家有新订单
    const sellerIds = [...new Set(availableItems.map(i => i.product.userId))]
    for (const sellerId of sellerIds) {
      if (sellerId === req.user.id) continue
      await Notification.create({
        userId: sellerId,
        type: 'order',
        content: `您有新的订单 #${order.id}，买家已下单，等待对方确认收货`
      })
    }

    success(res, order, '下单成功，确认收货后将自动扣款')
  } catch (err) { next(err) }
}

export async function list(req, res, next) {
  try {
    const { role, status } = req.query
    const where = {}
    if (['pending', 'completed', 'cancelled', 'confirmed'].includes(status)) {
      where.status = status
    }

    let orders
    if (role === 'seller') {
      orders = await Order.findAll({
        include: [{
          model: OrderItem, as: 'items',
          where: { sellerId: req.user.id },
          include: [{ model: Product, as: 'product' }]
        }],
        order: [['created_at', 'DESC']]
      })
    } else {
      orders = await Order.findAll({
        where: { buyerId: req.user.id, ...where },
        include: [
          { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
          { model: AfterSale, as: 'aftersale', include: [{ model: User, as: 'admin', attributes: ['id', 'nickname'] }] }
        ],
        order: [['created_at', 'DESC']]
      })
    }
    success(res, orders)
  } catch (err) { next(err) }
}

// 确认收货：买家操作，pending → completed，此时才扣买家余额、给卖家入账
export async function confirmReceipt(req, res, next) {
  try {
    const order = await Order.findByPk(req.params.id)
    if (!order) return fail(res, '订单不存在', 404)
    if (order.buyerId !== req.user.id) return fail(res, '只能操作自己的订单', 403)
    if (order.status !== 'pending') return fail(res, '订单当前状态不可确认收货')

    const totalPrice = Number(order.totalPrice)

    // 旧版本流程「下单即扣款」，补充列时已把这些订单迁移成 completed；
    // 这里再加一道流水校验，保证已结清的订单绝不会被二次扣款
    const paid = await BalanceLog.findOne({ where: { userId: order.buyerId, type: 'pay', orderId: order.id } })
    if (paid) {
      order.status = 'completed'
      await order.save()
      return success(res, order, '确认收货成功，订单已完成')
    }

    const items = await OrderItem.findAll({ where: { orderId: order.id } })
    const sellerGain = new Map()
    items.forEach((it) => {
      sellerGain.set(it.sellerId, (sellerGain.get(it.sellerId) || 0) + Number(it.price))
    })

    const buyer = await User.findByPk(order.buyerId)
    if (Number(buyer.balance) < totalPrice) {
      return fail(res, `余额不足，当前余额 ¥${Number(buyer.balance).toFixed(2)}，本单需 ¥${totalPrice.toFixed(2)}，请先充值`)
    }

    const sellers = await User.findAll({ where: { id: [...sellerGain.keys()] }, attributes: ['id', 'balance', 'pendingBalance'] })
    const sellerBalance = new Map(sellers.map(s => [s.id, Number(s.balance)]))
    const sellerPending = new Map(sellers.map(s => [s.id, Number(s.pendingBalance) || 0]))

    await withRetry(() => sequelize.transaction(async (tx) => {
      await User.update(
        { balance: sequelize.literal(`balance - ${totalPrice}`) },
        { where: { id: order.buyerId }, transaction: tx }
      )
      await BalanceLog.create({
        userId: order.buyerId,
        type: 'pay',
        amount: -totalPrice,
        balanceAfter: Number(buyer.balance) - totalPrice,
        orderId: order.id,
        note: `订单 #${order.id} 确认收货扣款`
      }, { transaction: tx })

      const releaseAt = new Date(Date.now() + 24 * 3600 * 1000)
      for (const [sellerId, gain] of sellerGain) {
        // 卖家收入先进「待存余额」，24h 后由定时任务解冻到账户余额
        await User.update(
          { pendingBalance: sequelize.literal(`pending_balance + ${gain}`) },
          { where: { id: sellerId }, transaction: tx }
        )
        await BalanceLog.create({
          userId: sellerId,
          type: 'income_escrow',
          amount: gain,
          balanceAfter: sellerBalance.get(sellerId) || 0,
          pendingAfter: (sellerPending.get(sellerId) || 0) + gain,
          releaseAt,
          released: false,
          orderId: order.id,
          note: `订单 #${order.id} 售出收入（待存，${releaseAt.toLocaleString('zh-CN')} 自动到账）`
        }, { transaction: tx })
      }

      order.status = 'completed'
      order.completedAt = new Date()
      await order.save({ transaction: tx })
    }))

    for (const [sellerId, gain] of sellerGain) {
      await Notification.create({
        userId: sellerId,
        type: 'order',
        content: `订单 #${order.id} 买家已确认收货，¥${gain.toFixed(2)} 已入待存余额，24 小时后自动到账`
      })
    }

    success(res, order, '确认收货成功，款项已从余额扣除，卖家收入进入待存')
  } catch (err) { next(err) }
}

// 取消订单：只能取消待收货（pending）的订单；下单未扣款，取消只恢复商品，不动余额
export async function updateStatus(req, res, next) {
  try {
    const { status } = req.body
    if (status !== 'cancelled') return fail(res, '订单状态只能通过确认收货或取消来变更')

    const order = await Order.findByPk(req.params.id)
    if (!order) return fail(res, '订单不存在', 404)

    // 买家本人、订单内卖家或管理员可以取消
    if (req.user.role !== 'admin' && order.buyerId !== req.user.id) {
      const asSeller = await OrderItem.findOne({ where: { orderId: order.id, sellerId: req.user.id } })
      if (!asSeller) return fail(res, '无权操作该订单', 403)
    }

    if (order.status !== 'pending') return fail(res, '只有待收货的订单可以取消')

    const items = await OrderItem.findAll({ where: { orderId: order.id }, attributes: ['productId', 'sellerId'] })

    await withRetry(() => sequelize.transaction(async (tx) => {
      // 先恢复商品为可售（拿商品行 X 锁，与明细外键无冲突）
      await Product.update(
        { status: 'available' },
        { where: { id: items.map(it => it.productId) } },
        { transaction: tx }
      )
      order.status = 'cancelled'
      await order.save({ transaction: tx })
    }))

    const sellerIds = [...new Set(items.map(it => it.sellerId))]
    for (const sellerId of sellerIds) {
      if (sellerId === order.buyerId) continue
      await Notification.create({
        userId: sellerId,
        type: 'order',
        content: `订单 #${order.id} 已取消，商品已重新上架`
      })
    }

    success(res, order, '订单已取消')
  } catch (err) { next(err) }
}

// 申请售后：买家对已完成订单发起（被驳回后允许重新申请）
// 确认收货后 23 小时内可申请售后（给 24h 待存解冻留 1 小时缓冲）
const AFTERSALE_WINDOW_MS = 23 * 3600 * 1000

export async function applyAftersale(req, res, next) {
  try {
    const order = await Order.findByPk(req.params.id)
    if (!order) return fail(res, '订单不存在', 404)
    if (order.buyerId !== req.user.id) return fail(res, '只能操作自己的订单', 403)
    if (order.status !== 'completed') return fail(res, '只有已完成的订单可以申请售后')

    const completedAt = order.completedAt ? new Date(order.completedAt).getTime() : null
    if (completedAt && Date.now() - completedAt > AFTERSALE_WINDOW_MS) {
      return fail(res, '已超过确认收货后 23 小时，售后窗口已关闭（款项即将解冻给卖家）')
    }

    const reason = String(req.body.reason || '').trim().slice(0, 500)
    if (!reason) return fail(res, '请填写售后原因')
    const type = req.body.type === 'return_refund' ? 'return_refund' : 'refund_only'
    const typeText = type === 'return_refund' ? '退货退款' : '仅退款'

    const items = await OrderItem.findAll({ where: { orderId: order.id }, attributes: ['sellerId'] })
    const sellerId = items.map(it => it.sellerId).find(id => id && id !== order.buyerId) || null

    const existing = await AfterSale.findOne({ where: { orderId: order.id } })
    const allowedReapply = ['rejected', 'seller_reject_approved', 'closed']
    if (existing && !allowedReapply.includes(existing.status)) {
      return fail(res, '该订单已在售后处理中，请勿重复申请')
    }
    if (existing && existing.appealed) {
      return fail(res, '申诉已处理完毕，无法再次申请售后')
    }

    const fields = {
      reason,
      type,
      amount: order.totalPrice,
      sellerId,
      status: 'pending',
      adminId: null,
      adminNote: '',
      rejectReason: '',
      appealReason: null,
      refundedAt: null,
      handledAt: null
    }
    let aftersale
    if (existing) {
      await existing.update(fields)
      aftersale = existing
    } else {
      aftersale = await AfterSale.create({ orderId: order.id, buyerId: req.user.id, ...fields })
    }

    order.aftersaleStatus = 'pending'
    await order.save()

    if (sellerId) {
      await Notification.create({
        userId: sellerId,
        type: 'aftersale',
        content: `买家对订单 #${order.id} 发起了${typeText}售后申请，待管理员审核，请留意卖家中心的售后处理`
      })
    }

    success(res, order, `${typeText}申请已提交，等待管理员审核`)
  } catch (err) { next(err) }
}

// 联系管理员：自动分配一个当前会话量最少的管理员与买家对话（需先申请售后）
export async function contactAdmin(req, res, next) {
  try {
    const order = await Order.findByPk(req.params.id)
    if (!order) return fail(res, '订单不存在', 404)
    if (order.buyerId !== req.user.id) return fail(res, '只能操作自己的订单', 403)
    if (order.status !== 'completed') return fail(res, '只有已完成的订单可以联系管理员')

    const admins = await User.findAll({
      where: { role: 'admin', status: 'active' },
      attributes: ['id', 'nickname']
    })
    if (!admins.length) return fail(res, '暂无可用管理员，请稍后再试', 404)

    // 从管理员中随机挑选一位接待
    const admin = admins[Math.floor(Math.random() * admins.length)]

    const buyerId = order.buyerId
    let conv = await Conversation.findOne({
      where: {
        [Op.or]: [
          { buyerId, sellerId: admin.id },
          { buyerId: admin.id, sellerId: buyerId }
        ]
      },
      order: [['last_message_at', 'DESC']]
    })
    if (!conv) {
      conv = await Conversation.create({ buyerId, sellerId: admin.id, productId: null, lastMessageAt: new Date(), type: 'admin' })
    } else if (conv.type !== 'admin') {
      await conv.update({ type: 'admin' })
    }
    const reason = order.aftersaleStatus === 'applied'
      ? `我对订单 #${order.id} 申请了售后，请管理员协助处理`
      : `我想就订单 #${order.id} 咨询一下，请管理员协助处理`
    await ChatMessage.create({
      conversationId: conv.id,
      senderId: buyerId,
      content: `你好，${reason}`
    })
    await conv.update({ lastMessageAt: new Date() })

    await Notification.create({
      userId: admin.id,
      type: 'aftersale',
      content: `系统分配：买家就订单 #${order.id} 发起咨询${order.aftersaleStatus === 'applied' ? '（含售后）' : ''}，请查看对话`
    })

    success(res, {
      conversationId: conv.id,
      admin: { id: admin.id, nickname: admin.nickname }
    }, '已为您接入管理员客服，请在对话中查看')
  } catch (err) { next(err) }
}
