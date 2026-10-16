const http = require('http')
const fs = require('fs')
const path = require('path')

const distDir = path.join(__dirname, 'web', 'dist')
const port = 8080

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

const server = http.createServer((req, res) => {
  let filePath = path.join(distDir, req.url)
  if (req.url === '/' || req.url === '') filePath = path.join(distDir, 'index.html')
  
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

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})