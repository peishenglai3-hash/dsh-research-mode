// Normalise tracked text files to LF so a fresh clone reproduces the bytes that
// manifest.sha256 hashes. Binary files (git reports them as `-text`) are skipped.
//
//   node tools/w01/normalize-eol.mjs [--check]
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const checkOnly = process.argv.includes('--check')

const raw = execFileSync('git', ['ls-files', '--eol'], { cwd: repoRoot, encoding: 'buffer' })
const lines = raw.toString('utf8').split('\n').filter(Boolean)

let converted = 0
const pending = []
for (const line of lines) {
  const tab = line.indexOf('\t')
  if (tab === -1) continue
  const meta = line.slice(0, tab)
  const relPath = line.slice(tab + 1)
  // `i/-text` means git considers the file binary; leave it untouched.
  if (/\bi\/-text\b/.test(meta)) continue
  if (/\bw\/lf\b/.test(meta)) continue
  const abs = join(repoRoot, relPath)
  const buffer = readFileSync(abs)
  const text = buffer.toString('utf8')
  const normalised = text.replace(/\r\n/g, '\n')
  if (normalised === text) continue
  pending.push(relPath)
  converted += 1
  if (!checkOnly) writeFileSync(abs, normalised, 'utf8')
}

console.log(`text files not LF before : ${converted}`)
if (pending.length > 0) console.log(pending.map((p) => `  ${p}`).join('\n'))
if (checkOnly) {
  console.log(converted === 0 ? 'CHECK: all text files are LF' : 'CHECK: CRLF remains')
  process.exitCode = converted === 0 ? 0 : 1
} else {
  console.log(`normalised ${converted} file(s) to LF`)
}
