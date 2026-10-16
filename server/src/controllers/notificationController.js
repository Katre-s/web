import { Notification, User } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export async function myList(req, res, next) {
  try {
    const list = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['id', 'DESC']],
      limit: 100
    })
    const unread = list.filter((n) => !n.isRead).length
    const data = {
      list: list.map((n) => ({
        id: n.id,
        type: n.type,
        content: n.content,
        isRead: n.isRead,
        time: n.createdAt
      })),
      unread
    }
    success(res, data)
  } catch (err) { next(err) }
}

export async function read(req, res, next) {
  try {
    await Notification.update(
      { isRead: true },
      { where: { id: req.params.id, userId: req.user.id } }
    )
    success(res, null, '已读')
  } catch (err) { next(err) }
}

export async function readAll(req, res, next) {
  try {
    await Notification.update(
      { isRead: true },
      { where: { userId: req.user.id } }
    )
    success(res, null, '全部已读')
  } catch (err) { next(err) }
}

export async function broadcast(req, res, next) {
  try {
    const { content } = req.body
    if (!content) return fail(res, '请输入通知内容')
    const users = await User.findAll({ attributes: ['id'] })
    const rows = users.map((u) => ({
      userId: u.id,
      type: 'broadcast',
      content,
      isRead: false
    }))
    if (rows.length) {
      await Notification.bulkCreate(rows)
    }
    success(res, { count: rows.length }, '已发送给全部用户')
  } catch (err) { next(err) }
}

export async function sendToOne(req, res, next) {
  try {
    const { userId, content } = req.body
    if (!userId || !content) return fail(res, '请填写用户和内容')
    const user = await User.findByPk(userId)
    if (!user) return fail(res, '用户不存在')
    await Notification.create({
      userId,
      type: 'single',
      content,
      isRead: false
    })
    success(res, null, '通知已发送')
  } catch (err) { next(err) }
}