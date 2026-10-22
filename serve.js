const http = require('http')
const fs = require('fs')
const path = require('path')

const distDir = path.join(__dirname, 'web', 'dist')
const port = 8080
const API_TARGET = 'http://121.40.219.139:3000'

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

function proxyApi(req, res) {
  const target = new URL(API_TARGET + req.url)
  const options = {
    hostname: target.hostname,
    port: target.port,
    path: target.pathname + target.search,
    method: req.method,
    headers: { ...req.headers, host: target.host }
  }
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })
  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ code: 502, message: '后端服务不可达: ' + err.message }))
  })
  req.pipe(proxyReq)
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) {
    proxyApi(req, res)
    return
  }

  let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url)
  const ext = path.extname(filePath)
  const contentType = mimeTypes[ext] || 'application/octet-stream'

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(distDir, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not found') }
        else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(data2) }
      })
      return
    }
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`徐工院小咸鱼本地预览: http://localhost:${port}`)
  console.log(`API 代理: ${API_TARGET}`)
})