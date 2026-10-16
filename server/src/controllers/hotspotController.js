import { Hotspot, User } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export async function list(req, res, next) {
  try {
    const list = await Hotspot.findAll({
      where: { status: 'active' },
      order: [['sort_order', 'ASC'], ['id', 'DESC']],
      limit: 50
    })
    const data = list.map((h) => ({
      id: h.id,
      tag: h.tag,
      title: h.title,
      description: h.description,
      author: h.author || '同学',
      time: h.createdAt
    }))
    success(res, data)
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const { title, tag, description } = req.body
    if (!title || !description) return fail(res, '请填写标题和内容')
    const user = await User.findByPk(req.user.id)
    if (!user) return fail(res, '用户不存在')

    const maxOrder = await Hotspot.max('sort_order')
    const hotspot = await Hotspot.create({
      userId: user.id,
      title,
      tag: tag || '分享',
      description,
      author: user.nickname || '同学',
      sortOrder: (maxOrder || 0) + 1
    })
    success(res, hotspot, '投稿成功')
  } catch (err) { next(err) }
}

export async function remove(req, res, next) {
  try {
    const id = req.params.id
    const hotspot = await Hotspot.findByPk(id)
    if (!hotspot) return fail(res, '帖子不存在')
    await hotspot.update({ status: 'deleted' })
    success(res, null, '帖子已删除')
  } catch (err) { next(err) }
}

export async function move(req, res, next) {
  try {
    const id = Number(req.params.id)
    const direction = req.body.direction === 'up' ? -1 : 1
    const list = await Hotspot.findAll({
      where: { status: 'active' },
      order: [['sort_order', 'ASC'], ['id', 'DESC']]
    })
    const index = list.findIndex((h) => h.id === id)
    if (index === -1) return fail(res, '帖子不存在')
    const target = index + direction
    if (target < 0 || target >= list.length) return fail(res, '已在边界位置')

    const current = list[index]
    const neighbor = list[target]
    const tmp = current.sortOrder
    await current.update({ sortOrder: neighbor.sortOrder })
    await neighbor.update({ sortOrder: tmp })
    success(res, null, '顺序已调整')
  } catch (err) { next(err) }
}

export async function adminList(req, res, next) {
  try {
    const list = await Hotspot.findAll({
      order: [['sort_order', 'ASC'], ['id', 'DESC']]
    })
    success(res, list)
  } catch (err) { next(err) }
}