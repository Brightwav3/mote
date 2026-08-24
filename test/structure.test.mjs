/* Checks the decision record itself: numbering, mandatory sections, instruction
   file equality, and that both link directions hold. An ADR nobody can find is
   the failure this whole scheme exists to prevent. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const decisions = join(root, 'docs', 'decisions')

const REQUIRED = ['## Context', '## Decision', '## Rejected alternatives',
  '## Consequences', '## Enforced in', '## Explicit non-decisions']
const isAdr = (f) => /^\d{4}-.*\.md$/.test(f)

test('ADRs are numbered from 0001 with no gaps', async () => {
  const files = (await readdir(decisions)).filter(isAdr).sort()
  assert.ok(files.length > 0, 'no ADRs')
  files.forEach((f, i) => {
    const n = Number(f.slice(0, 4))
    assert.equal(n, i + 1, `expected ${String(i + 1).padStart(4, '0')}, found ${f}`)
  })
})

test('every ADR has all mandatory sections and no TBDs', async () => {
  const files = (await readdir(decisions)).filter(isAdr)
  for (const f of files) {
    const body = await readFile(join(decisions, f), 'utf8')
    for (const section of REQUIRED) {
      assert.ok(body.includes(section), `${f} missing ${section}`)
    }
    assert.ok(!/\bTBD\b/.test(body), `${f} contains TBD`)
    assert.ok(/^- \*\*Status:\*\* /m.test(body), `${f} missing Status`)
  }
})

test('CLAUDE.md and AGENTS.md are byte-identical', async () => {
  const a = await readFile(join(root, 'CLAUDE.md'), 'utf8')
  const b = await readFile(join(root, 'AGENTS.md'), 'utf8')
  assert.equal(a, b, 'instruction files have diverged')
})

test('every path an ADR claims to govern exists and cites it back', async () => {
  const files = (await readdir(decisions)).filter(isAdr)
  for (const f of files) {
    const body = await readFile(join(decisions, f), 'utf8')
    const block = body.split('## Enforced in')[1].split('##')[0]
    const paths = [...block.matchAll(/^- `([^`]+)`/gm)].map((m) => m[1])
    assert.ok(paths.length > 0, `${f} lists no governed paths`)
    for (const p of paths) {
      const src = await readFile(join(root, p), 'utf8').catch(() => null)
      assert.ok(src !== null, `${f} governs missing file ${p}`)
      if (p.endsWith('.md') || p.endsWith('.json') || p === 'NOTICE') continue
      const adr = f.replace(/\.md$/, '')
      const num = adr.slice(0, 4)
      assert.ok(src.includes(`ADR ${Number(num)}`) || src.includes(adr) || src.includes(num),
        `${p} does not reference ${f}`)
    }
  }
})

test('the manifest matches what is on disk', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'src', 'manifest.json'), 'utf8'))
  for (const p of manifest) {
    const src = await readFile(join(root, 'src', p), 'utf8').catch(() => null)
    assert.ok(src !== null, `manifest lists missing ${p}`)
    assert.ok(!/^\s*(import|export)\s/m.test(src), `${p} uses import/export (ADR 0002)`)
  }
})
