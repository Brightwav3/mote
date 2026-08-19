/* Serves dist/ for local viewing. No dependencies on purpose — the whole
   project builds and runs with nothing but Node. */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dist = join(dirname(fileURLToPath(import.meta.url)), 'dist')
const port = Number(process.env.PORT || 5199)

createServer(async (req, res) => {
  const path = (req.url || '/').split('?')[0]
  const file = path === '/' ? 'index.html' : path.replace(/^\/+/, '')
  try {
    const body = await readFile(join(dist, file))
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(port, () => console.log(`mote on http://localhost:${port}`))
