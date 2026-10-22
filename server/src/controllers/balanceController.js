import { sequelize } from '../config/database.js'
import { User, BalanceLog } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 充值：直接入账（模拟支付），上限单次 ¥5000
export async function recharge(req, res, next) {
  try {
    const raw = Number(req.body.amount)
    if (!Number.isFinite(raw) || raw <= 0) return fail(res, '请输入正确的充值金额')
    // 用「分」做整数校验，避免 0.1 * 100 = 10.000000000000002 这类浮点误判
    const cents = Math.round(raw * 100)
    if (Math.abs(cents - raw * 100) > 1e-6) return fail(res, '金额最多保留两位小数')
    const amount = cents / 100
    if (amount > 5000) return fail(res, '单次充值金额不能超过 ¥5000')

    const user = await User.findByPk(req.user.id)
    const balanceAfter = Number(user.balance) + amount

    await sequelize.transaction(async (tx) => {
      await User.update(
        { balance: sequelize.literal(`balance + ${amount}`) },
        { where: { id: req.user.id }, transaction: tx }
      )
      await BalanceLog.create({
        userId: req.user.id,
        type: 'recharge',
        amount,
        balanceAfter,
        note: '余额充值'
      }, { transaction: tx })
    })

    success(res, { balance: balanceAfter }, `充值成功，到账 ¥${amount.toFixed(2)}`)
  } catch (err) { next(err) }
}

// 余额流水：最近 50 条
export async function logs(req, res, next) {
  try {
    const list = await BalanceLog.findAll({
      where: { userId: req.user.id },
      order: [['id', 'DESC']],
      limit: 50
    })
    success(res, list)
  } catch (err) { next(err) }
}
