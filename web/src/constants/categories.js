/**
 * 交易类目（二级类目）
 * - value 直接作为 product.category 存库，务必保持稳定，不要随意改名
 * - key 用于 i18n：tradeCat.{key} / tradeCatHint.{key}
 * - 图书 走「书目板块」聚合视图，其余类目走「单件商品」列表视图
 */
export const TRADE_CATEGORIES = [
  { value: '图书', key: 'book', icon: '📚' },
  { value: '生活用品', key: 'living', icon: '🧺' },
  { value: '数码产品', key: 'digital', icon: '📱' },
  { value: '穿搭', key: 'outfit', icon: '👕' },
  { value: '出行', key: 'travel', icon: '🚲' },
  { value: '时尚首饰', key: 'jewelry', icon: '💍' },
  { value: '文玩', key: 'collectible', icon: '🪷' },
  { value: '租房', key: 'rental', icon: '🏠' },
  { value: '食品', key: 'food', icon: '🍪' }
]

export const DEFAULT_CATEGORY = '图书'

/**
 * 交易方式（三级）：目前只对「出行」类目开放
 * - sell 出售：一次性买断
 * - rent 出租：按天/按月租用（价格字段沿用 price）
 * value 直接存 product.dealType
 */
export const DEAL_TYPE_OPTIONS = [
  { value: 'sell', key: 'Sell', icon: '💰' },
  { value: 'rent', key: 'Rent', icon: '🔑' }
]

export const DEFAULT_DEAL_TYPE = 'sell'

/** 只有出行类目才需要区分出售/出租 */
export function supportsDealType(category) {
  return category === '出行'
}

export const CATEGORY_VALUES = TRADE_CATEGORIES.map((c) => c.value)

export function getCategory(value) {
  return TRADE_CATEGORIES.find((c) => c.value === value) || TRADE_CATEGORIES[0]
}

/** 取类目的 i18n key；历史脏值（教材/小说等）统一回落到图书 */
export function categoryKey(value) {
  return getCategory(value).key
}

export function isValidCategory(value) {
  return CATEGORY_VALUES.includes(value)
}
