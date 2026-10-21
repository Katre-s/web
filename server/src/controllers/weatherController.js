import { resolveWeather } from '../services/weatherService.js'
import { success, fail } from '../utils/response.js'

/**
 * GET /api/weather?lat=&lon=
 * 不传坐标时使用默认城市（徐州云龙区，可在 .env 里改）
 * 天气是"锦上添花"的数据，失败返回 503，前端静默保持原样式即可。
 */
export async function current(req, res, next) {
  try {
    const data = await resolveWeather({ lat: req.query.lat, lon: req.query.lon })
    if (!data) return fail(res, '天气服务暂时不可用', 503)
    success(res, data)
  } catch (err) {
    next(err)
  }
}
