/* Concatenates src/ into a single self-contained dist/index.html.
   No bundler and no imports: the deploy target is one HTML file with a strict
   CSP, so every byte must already be inside it. See
   docs/decisions/0002-single-file-build.md. */
/* ADR 0002: no bundler, no imports in src/ — plain scripts concatenated in
   manifest order. docs/decisions/0002-single-file-build.md */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const src = (p) => join(root, 'src', p)

const manifest = JSON.parse(await readFile(src('manifest.json'), 'utf8'))
const parts = await Promise.all(manifest.map((p) => readFile(src(p), 'utf8')))
const head = await readFile(src('shell.html'), 'utf8')
const tail = await readFile(src('shell-tail.html'), 'utf8')

const out = head + '<script>' + parts.join('\n') + tail
await mkdir(join(root, 'dist'), { recursive: true })
await writeFile(join(root, 'dist', 'index.html'), out, 'utf8')
console.log(`built dist/index.html — ${manifest.length} modules, ${(out.length / 1024).toFixed(1)} KB`)
