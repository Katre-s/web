const http = require('http')
const fs = require('fs')
const out = 'backend-test.txt'
const req = http.get('http://121.40.219.139:3000/api/books?page=1&pageSize=1', (res) => {
  let data = ''
  res.on('data', (d) => (data += d))
  res.on('end', () => fs.writeFileSync(out, `OK HTTP ${res.statusCode}: ${data.slice(0, 300)}`))
})
req.on('error', (e) => fs.writeFileSync(out, 'FAIL: ' + e.message))
req.setTimeout(8000, () => { req.destroy(); fs.writeFileSync(out, 'TIMEOUT after 8s') })