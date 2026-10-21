/**
 * 实时天气服务
 * ------------------------------------------------------------------
 * 数据源：Open-Meteo（免费、免 Key、支持 WMO 天气码 + 真实日出日落）
 * 定位：不需要定位权限，固定默认到「徐州云龙区」
 *       如需换城市，改 .env 的 WEATHER_DEFAULT_* 即可（也支持 ?lat=&lon= 临时覆盖）
 *
 * 为什么放后端：
 *   1) 统一缓存 10 分钟，避免每个用户都打第三方接口
 *   2) 第三方式超时/报错时由后端兜住，主页保持原样式而不是报错
 *   3) 以后要换数据源只改这一处，前端不用动
 */

import axios from 'axios'

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'

const DEFAULT_LOCATION = {
  lat: Number(process.env.WEATHER_DEFAULT_LAT) || 34.2538,
  lon: Number(process.env.WEATHER_DEFAULT_LON) || 117.2264,
  city: process.env.WEATHER_DEFAULT_CITY || '徐州云龙区'
}

// WMO weather code → [前端场景, 中文描述]
const WMO = {
  0: ['clear', '晴'],
  1: ['clear', '晴间多云'],
  2: ['partly', '多云'],
  3: ['cloudy', '阴'],
  45: ['fog', '雾'],
  48: ['fog', '雾凇'],
  51: ['drizzle', '毛毛雨'],
  53: ['drizzle', '小雨'],
  55: ['drizzle', '细雨'],
  56: ['drizzle', '冻毛毛雨'],
  57: ['drizzle', '冻雨'],
  61: ['rain', '小雨'],
  63: ['rain', '中雨'],
  65: ['rain', '大雨'],
  66: ['rain', '冻雨'],
  67: ['rain', '强冻雨'],
  71: ['snow', '小雪'],
  73: ['snow', '中雪'],
  75: ['snow', '大雪'],
  77: ['snow', '米雪'],
  80: ['rain', '阵雨'],
  81: ['rain', '强阵雨'],
  82: ['rain', '暴雨'],
  85: ['snow', '阵雪'],
  86: ['snow', '强阵雪'],
  95: ['thunder', '雷阵雨'],
  96: ['thunder', '雷阵雨伴冰雹'],
  99: ['thunder', '强雷阵雨伴冰雹']
}

const CACHE_TTL = 10 * 60 * 1000
const cache = new Map()

function cacheGet(key) {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expire) {
    cache.delete(key)
    return null
  }
  return hit.data
}

function cacheSet(key, data) {
  if (cache.size > 100) cache.clear()
  cache.set(key, { data, expire: Date.now() + CACHE_TTL })
}

function toCoord(v, limit) {
  const n = Number(v)
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null
  return n
}

/** 本地时间串（无时区）→ 带偏移的 ISO，浏览器才能正确算出"现在离日落还有多久" */
function withOffset(localIso, offsetSeconds) {
  if (!localIso) return ''
  const offset = Number(offsetSeconds) || 0
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  const hh = String(Math.floor(abs / 3600)).padStart(2, '0')
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, '0')
  const base = localIso.length === 16 ? `${localIso}:00` : localIso
  return `${base}${sign}${hh}:${mm}`
}

async function fetchOpenMeteo(lat, lon) {
  const { data } = await axios.get(OPEN_METEO, {
    params: {
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
      daily: 'sunrise,sunset',
      timezone: 'auto',
      forecast_days: 1
    },
    timeout: 7000
  })

  const cur = data?.current
  if (!cur) return null

  const code = Number(cur.weather_code)
  const [scene, text] = WMO[code] || ['cloudy', '多云']
  const offset = data.utc_offset_seconds || 0

  return {
    scene,
    text,
    code,
    temperature: Math.round(Number(cur.temperature_2m) * 10) / 10,
    apparent: Math.round(Number(cur.apparent_temperature) * 10) / 10,
    humidity: Math.round(Number(cur.relative_humidity_2m)),
    wind: Math.round(Number(cur.wind_speed_10m)),
    isDay: Number(cur.is_day) === 1,
    timezone: data.timezone || '',
    localTime: cur.time || '',
    sunrise: withOffset(data.daily?.sunrise?.[0], offset),
    sunset: withOffset(data.daily?.sunset?.[0], offset)
  }
}

/**
 * @param {{lat?:string|number, lon?:string|number}} input 可选，不传就用默认城市
 * @returns {Promise<object|null>}
 */
export async function resolveWeather({ lat, lon } = {}) {
  const customLat = toCoord(lat, 90)
  const customLon = toCoord(lon, 180)
  const hasCustom = customLat !== null && customLon !== null

  const latitude = hasCustom ? customLat : DEFAULT_LOCATION.lat
  const longitude = hasCustom ? customLon : DEFAULT_LOCATION.lon
  const city = hasCustom ? '' : DEFAULT_LOCATION.city

  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`
  const cached = cacheGet(key)
  if (cached) return cached

  const weather = await fetchOpenMeteo(latitude, longitude)
  if (!weather) return null

  const data = {
    ...weather,
    city,
    latitude,
    longitude,
    updatedAt: Date.now()
  }
  cacheSet(key, data)
  return data
}
