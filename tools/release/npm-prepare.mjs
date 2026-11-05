// Prepare the published bundles for npm: publishable names, repository backlink, files
// allowlist, and the metadata the community registry checks.
//
// Why rename at all: `@local/*` is a private alias and cannot be published, and the community
// index keeps an entry only when the *published package's* repository.url names the repo back.
//
//   node tools/release/npm-prepare.mjs --dry-run
//   node tools/release/npm-prepare.mjs --scope @peishenglai3-hash
//
// Surgical: it edits named fields and leaves everything else (exports, type, engines, dsh,
// description) exactly as it is. Idempotent.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const scope = arg('scope', '@peisheng_lai')
const repoUrl = arg('repo', 'https://github.com/peishenglai3-hash/dsh-research-mode')
const dryRun = process.argv.includes('--dry-run')

const activeDir = join(repoRoot, 'plugins', 'active')

// Deliberately not published: it executes code, has no per-tool authorization, and its sandbox
// declares no network isolation. It stays in the repository for reference and for profiles that
// opt in locally, but it does not go to a public registry.
const NOT_PUBLISHED = new Set(['research-phase2-exec'])
const changed = []
const skipped = []

for (const dirName of readdirSync(activeDir)) {
  const dir = join(activeDir, dirName)
  const pkgPath = join(dir, 'package.json')
  try { if (!statSync(pkgPath).isFile()) continue } catch { continue }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  if (!pkg.dsh?.bundle) { skipped.push(`${dirName}: not a bundle`); continue }
  if (NOT_PUBLISHED.has(dirName)) { skipped.push(`${dirName}: deliberately not published (executes code)`); continue }

  const oldName = pkg.name
  const newName = `${scope}/dsh-${dirName}`

  // --- package.json: named fields only -------------------------------------
  const next = { ...pkg }
  next.name = newName
  next.license = 'MIT'
  next.repository = { type: 'git', url: `git+${repoUrl}.git`, directory: `plugins/active/${dirName}` }
  next.publishConfig = { access: 'public' }
  // A private package cannot be published; that is the point of this step.
  delete next.private
  const wantFiles = new Set([...(pkg.files ?? []), 'package.json', 'cordis.patch.yml', 'README.md'])
  if (existsSync(join(dir, 'client.js'))) wantFiles.add('client.js')
  if (existsSync(join(dir, 'index.js'))) wantFiles.add('index.js')
  next.files = [...wantFiles].sort()

  const before = JSON.stringify(pkg, null, 2)
  const after = JSON.stringify(next, null, 2)
  if (before !== after) {
    if (!dryRun) writeFileSync(pkgPath, after + '\n', 'utf8')
    const fields = []
    if (oldName !== newName) fields.push('name')
    if (pkg.private !== undefined) fields.push('private')
    if (!pkg.license) fields.push('license')
    if (!pkg.repository) fields.push('repository')
    if (!pkg.publishConfig) fields.push('publishConfig')
    if (JSON.stringify(pkg.files) !== JSON.stringify(next.files)) fields.push('files')
    changed.push(`plugins/active/${dirName}/package.json: [${fields.join(',')}]${oldName !== newName ? ` ${oldName} -> ${newName}` : ''}`)
  }

  // --- self-references inside the bundle -----------------------------------
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const abs = join(d, entry)
      if (statSync(abs).isDirectory()) {
        if (entry !== 'node_modules') walk(abs)
        continue
      }
      if (abs === pkgPath) continue
      if (!/\.(js|mjs|cjs|yml|yaml|json|md)$/i.test(entry)) continue
      const text = readFileSync(abs, 'utf8')
      if (!text.includes(oldName)) continue
      const replaced = text.split(oldName).join(newName)
      // A self-rename is a no-op once the package already carries its published name; writing
      // anyway would make the tool non-idempotent and spam the change log.
      if (replaced === text) continue
      if (!dryRun) writeFileSync(abs, replaced, 'utf8')
      changed.push(`${abs.slice(repoRoot.length + 1).replace(/\\/g, '/')}: ${oldName} -> ${newName}`)
    }
  }
  walk(dir)
}

console.log(JSON.stringify({ scope, repoUrl, dryRun, changedCount: changed.length, changed, skipped }, null, 2))
