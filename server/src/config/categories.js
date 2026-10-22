/**
 * 交易类目服务端配置（与 web/src/constants/categories.js 保持一致）
 * value 会直接写入 products.category
 */
export const TRADE_CATEGORIES = [
  '图书',
  '生活用品',
  '数码产品',
  '穿搭',
  '出行',
  '时尚首饰',
  '文玩',
  '租房',
  '食品'
]

export const DEFAULT_CATEGORY = '图书'

export function normalizeCategory(value) {
  const v = String(value || '').trim()
  return TRADE_CATEGORIES.includes(v) ? v : v || DEFAULT_CATEGORY
}

export function isBookCategory(value) {
  return normalizeCategory(value) === '图书'
}
