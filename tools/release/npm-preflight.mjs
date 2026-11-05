// Pre-flight for npm publication. Checks the things the community registry actually verifies,
// so a submission is not rejected for a metadata mistake that a local check could have caught.
//
//   node tools/release/npm-preflight.mjs
//   node tools/release/npm-preflight.mjs --pack      # also run `npm pack --dry-run` per package
//
// Offline: it reads package.json files and the filesystem. `--pack` invokes npm, still local.
// It does NOT publish, and it does NOT need an npm login.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const activeDir = join(repoRoot, 'plugins', 'active')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const scope = arg('scope', '@peisheng_lai')
const repoUrl = arg('repo', 'https://github.com/peishenglai3-hash/dsh-research-mode')
const withPack = process.argv.includes('--pack')

const NOT_PUBLISHED = new Set(['research-phase2-exec'])
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

const results = []
function check(pkgName, id, ok, detail) {
  results.push({ pkg: pkgName, id, ok, detail })
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${pkgName} · ${id} — ${detail}`)
}

for (const dirName of readdirSync(activeDir).sort()) {
  const dir = join(activeDir, dirName)
  const pkgPath = join(dir, 'package.json')
  if (!existsSync(pkgPath) || !statSync(pkgPath).isFile()) continue
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  if (!pkg.dsh?.bundle) continue

  if (NOT_PUBLISHED.has(dirName)) {
    check(dirName, 'not-published-by-design', pkg.private === true,
      `excluded from publication (executes code); private=${pkg.private}`)
    continue
  }

  const expected = `${scope}/dsh-${dirName}`
  check(dirName, 'name', pkg.name === expected, `${pkg.name} (expected ${expected})`)
  check(dirName, 'not-private', pkg.private === undefined, pkg.private ? 'still private:true, npm will refuse' : 'publishable')
  check(dirName, 'license', pkg.license === 'MIT', String(pkg.license))
  check(dirName, 'version', SEMVER.test(pkg.version ?? ''), String(pkg.version))
  check(dirName, 'engines.dsh', Boolean(pkg.engines?.dsh), String(pkg.engines?.dsh))
  check(dirName, 'dsh.bundle', Boolean(pkg.dsh?.bundle?.patch), String(pkg.dsh?.bundle?.patch))

  const patch = pkg.dsh?.bundle?.patch
  check(dirName, 'patch-file-exists', Boolean(patch) && existsSync(join(dir, patch)), String(patch))

  // The registry keeps a name only when the published package's repository.url names the repo back.
  const repoField = pkg.repository
  const repoOk = repoField?.url?.includes(repoUrl.replace(/^https?:\/\//, '').replace(/\.git$/, ''))
  check(dirName, 'repository-backlink', Boolean(repoOk),
    repoField?.url ? `${repoField.url} (directory ${repoField.directory})` : 'missing')
  check(dirName, 'repository-directory', repoField?.directory === `plugins/active/${dirName}`,
    String(repoField?.directory))

  const files = pkg.files ?? []
  const patchRel = String(patch ?? '').replace(/^\.\//, '')
  check(dirName, 'files-includes-patch', Boolean(patchRel) && files.some((f) => patchRel.startsWith(f.replace(/\/$/, ''))),
    `${patchRel} in [${files.join(',')}]`)
  const entry = pkg.exports?.['.'] ?? './index.js'
  if (typeof entry === 'string' && entry.endsWith('.js')) {
    const entryName = entry.replace(/^\.\//, '')
    check(dirName, 'files-includes-entry', files.some((f) => entryName.startsWith(f.replace(/\/$/, ''))),
      `${entryName} in [${files.join(',')}]`)
  }

  if (withPack) {
    try {
      // On Windows `npm` is a .ps1/.cmd shim, which Node 24 will not spawn directly (ENOENT/
      // EINVAL). Route through ComSpec; on POSIX npm is a real executable.
      const out = process.platform === 'win32'
        ? execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm pack --dry-run --json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
        : execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      const parsed = JSON.parse(out)
      const count = parsed?.[0]?.entryCount ?? parsed?.[0]?.files?.length ?? 0
      check(dirName, 'npm-pack', count > 0, `${count} files in tarball`)
    } catch (error) {
      check(dirName, 'npm-pack', false, `npm pack failed: ${String(error.message).slice(0, 120)}`)
    }
  }
}

const failed = results.filter((r) => !r.ok)
console.log(`\nNPM PREFLIGHT: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${results.length - failed.length}/${results.length})`)
if (failed.length) {
  console.log('failures:')
  for (const f of failed) console.log(`  - ${f.pkg} · ${f.id}: ${f.detail}`)
  process.exitCode = 1
}
