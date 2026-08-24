/* Serves dist/ for local viewing. No dependencies on purpose — the whole
   project builds and runs with nothing but Node. */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dist = join(dirname(fileURLToPath(import.meta.url)), 'dist')
const port = Number(process.env.PORT || 5199)
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
}

createServer(async (req, res) => {
  const path = (req.url || '/').split('?')[0]
  const file = path === '/' ? 'index.html' : path.replace(/^\/+/, '')
  try {
    const body = await readFile(join(dist, file))
    const extension = file.slice(file.lastIndexOf('.'))
    res.writeHead(200, { 'content-type': contentTypes[extension] || 'application/octet-stream', 'cache-control': 'no-store' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(port, () => console.log(`mote on http://localhost:${port}`))
