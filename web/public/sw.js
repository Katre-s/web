// 徐工院小咸鱼 - 离线壳 & 静态资源缓存
// v2：assets 用「缓存优先 + 哈希文件名」，上传图走独立运行时缓存并限量，避免缓存无限膨胀导致手机端变慢
const VERSION = 'xiaoxianyu-v1'
const SHELL_CACHE = `${VERSION}-shell`
const ASSET_CACHE = `${VERSION}-assets`
const IMG_CACHE = `${VERSION}-img`
const IMG_CACHE_LIMIT = 80
const APP_SHELL = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// 主线程可要求立即接管（配合 main.js 的更新逻辑）
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

async function trimCache(name, max) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  if (keys.length <= max) return
  for (const key of keys.slice(0, keys.length - max)) {
    await cache.delete(key)
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.pathname.startsWith('/api')) return

  // 页面导航：网络优先，断网时回退到壳，保证不会白屏
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/').then((cached) => cached || Response.error()))
    )
    return
  }

  // 带 hash 的构建产物 / 图标：缓存优先，命中即秒开
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(ASSET_CACHE).then((cache) => cache.put(req, copy))
            }
            return response
          })
      )
    )
    return
  }

  // 上传的书籍封面：缓存优先 + 限量，减少移动端重复下载
  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(IMG_CACHE).then(async (cache) => {
                await cache.put(req, copy)
                trimCache(IMG_CACHE, IMG_CACHE_LIMIT)
              })
            }
            return response
          })
      )
    )
  }
})
