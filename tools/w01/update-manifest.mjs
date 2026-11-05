// Regenerate manifest.sha256 so it describes exactly the tree git will ship.
//
// Superseded design note: an earlier version scanned evidence directories and appended
// whatever it found, so any new probe file silently invalidated the manifest and the
// manifest could list files a clone would never contain. The invariant is now:
//
//     set(manifest entries) === set(git-tracked files) - { manifest.sha256 }
//
// which makes "the manifest verifies after a fresh clone" true by construction, and makes
// untracked/ignored evidence harmless.
//
// Because the source of truth is the git index, run `git add -A` BEFORE generating so the
// files you are about to commit are already tracked; then stage manifest.sha256 and commit.
//
//   node tools/w01/update-manifest.mjs [--check]
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const manifestPath = join(repoRoot, 'manifest.sha256')
const SELF = 'manifest.sha256'
const checkOnly = process.argv.includes('--check')

const BOM = '\uFEFF'
const raw = readFileSync(manifestPath, 'utf8')
const hasBom = raw.startsWith(BOM)
const body = hasBom ? raw.slice(1) : raw
const lines = body.split(/\r?\n/)
const LINE = /^\s*([0-9a-fA-F]{64})\s+\*?(.+)$/

function digest(relPath) {
  const hostPath = join(repoRoot, relPath)
  if (!existsSync(hostPath)) throw new Error(`tracked file missing from worktree: ${relPath}`)
  return createHash('sha256').update(readFileSync(hostPath)).digest('hex')
}

// The git index is authoritative. Forward slashes in, backslashes in the manifest.
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' })
  .split('\u0000')
  .filter(Boolean)
  .filter((p) => p !== SELF)
  .map((p) => p.replace(/\//g, '\\'))

const trackedSet = new Set(tracked)
let updated = 0
let unchanged = 0
const changedPaths = []
const droppedPaths = []
const present = new Set()

const next = lines.filter((line) => {
  const match = line.match(LINE)
  if (!match) return true // keep blank/trailing lines until the end
  const relPath = match[2].trim()
  if (!trackedSet.has(relPath)) {
    droppedPaths.push(relPath)
    return false
  }
  present.add(relPath)
  return true
}).map((line) => {
  const match = line.match(LINE)
  if (!match) return line
  const oldHash = match[1].toLowerCase()
  const relPath = match[2].trim()
  const newHash = digest(relPath)
  if (newHash === oldHash) {
    unchanged += 1
    return line
  }
  updated += 1
  changedPaths.push(relPath)
  return `${newHash}  ${relPath}`
})

const missing = tracked.filter((relPath) => !present.has(relPath)).sort()
if (missing.length > 0) {
  while (next.length > 0 && next[next.length - 1] === '') next.pop()
  for (const relPath of missing) next.push(`${digest(relPath)}  ${relPath}`)
  next.push('')
}

console.log(`tracked files (excl. manifest) : ${tracked.length}`)
console.log(`manifest entries before        : ${present.size + droppedPaths.length}`)
console.log(`changed lines updated          : ${updated}`)
console.log(`new tracked files appended     : ${missing.length}${missing.length ? ` (${missing.join(', ')})` : ''}`)
console.log(`untracked/unignored lines dropped: ${droppedPaths.length}${droppedPaths.length ? ` (${droppedPaths.join(', ')})` : ''}`)
console.log(`bom preserved                  : ${hasBom}`)
if (changedPaths.length > 0) {
  console.log(`changed entries:\n${changedPaths.map((p) => `  ${p}`).join('\n')}`)
}

const dirty = updated > 0 || missing.length > 0 || droppedPaths.length > 0
if (checkOnly) {
  console.log(dirty ? 'CHECK: stale' : 'CHECK: up to date')
  process.exitCode = dirty ? 1 : 0
} else {
  // LF matches .gitattributes (`* text=auto eol=lf`), so a fresh clone reproduces these bytes.
  const out = `${hasBom ? BOM : ''}${next.join('\n')}`
  writeFileSync(manifestPath, out, 'utf8')
  console.log('manifest.sha256 rewritten')
}
