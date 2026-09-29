import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const root = path.resolve('out')
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}
http
  .createServer((req, res) => {
    const relative = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname,
    )
    let file = path.resolve(root, '.' + relative)
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.writeHead(403).end()
      return
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
      file = path.join(file, 'index.html')
    if (!fs.existsSync(file)) {
      res.writeHead(404).end('Not found')
      return
    }
    res.setHeader(
      'Content-Type',
      types[path.extname(file)] ?? 'application/octet-stream',
    )
    fs.createReadStream(file).pipe(res)
  })
  .listen(3002, '127.0.0.1', () =>
    console.log('Address book: http://localhost:3002'),
  )
