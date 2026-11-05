// Publish the nine bundles, in one place, with an honest per-package report.
//
// Publishing needs write auth. If the npm account has 2FA on writes, either pass --otp <code>
// (valid ~30s; reuse is allowed across consecutive publishes in the same window) or use an
// automation / granular token with "bypass 2fa" set in .npmrc, which needs no OTP at all.
//
//   node tools/release/publish-all.mjs --dry-run
//   node tools/release/publish-all.mjs --otp 123456
//   npm_config_//registry.npmjs.org/:_authToken=... node tools/release/publish-all.mjs
//
// Stops at the first failure so a half-published scope is visible immediately.
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
const otp = arg('otp', null)
const dryRun = process.argv.includes('--dry-run')
const NOT_PUBLISHED = new Set(['research-phase2-exec'])

const targets = []
for (const dirName of readdirSync(activeDir).sort()) {
  const dir = join(activeDir, dirName)
  const pkgPath = join(dir, 'package.json')
  if (!existsSync(pkgPath) || !statSync(pkgPath).isFile()) continue
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  if (!pkg.dsh?.bundle) continue
  if (NOT_PUBLISHED.has(dirName)) { console.log(`[skip] ${dirName}: deliberately not published`); continue }
  targets.push({ dirName, dir, name: pkg.name, version: pkg.version })
}

console.log(`publishing ${targets.length} packages${dryRun ? ' (dry run)' : ''}${otp ? ' with OTP' : ' (no OTP given)'}\n`)

const results = []
for (const t of targets) {
  const args = ['publish', '--access', 'public']
  if (dryRun) args.push('--dry-run')
  if (otp) args.push('--otp', otp)
  try {
    // `npm` is a shim on Windows; Node 24 will not spawn it directly.
    const out = process.platform === 'win32'
      ? execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], { cwd: t.dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      : execFileSync('npm', args, { cwd: t.dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    results.push({ ...t, ok: true })
    console.log(`[OK]   ${t.name}@${t.version}`)
    void out
  } catch (error) {
    const stderr = String(error.stderr ?? error.message ?? '')
    const code = /EOTP|one-time password/i.test(stderr) ? 'EOTP'
      : /E403/.test(stderr) ? 'E403'
      : /EPUBLISHCONFLICT|cannot publish over/i.test(stderr) ? 'EXISTS'
      : 'OTHER'
    results.push({ ...t, ok: false, code, message: stderr.split('\n').filter(Boolean).slice(-4).join(' | ').slice(0, 300) })
    console.log(`[FAIL] ${t.name}@${t.version} — ${code}`)
    console.log(`       ${stderr.split('\n').find((l) => l.includes('npm error')) ?? ''}`.trim())
    if (code === 'EOTP' || code === 'E403') {
      console.log('\nStopping: write auth was rejected, so the remaining packages would fail the same way.')
      break
    }
  }
}

const ok = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok)
console.log(`\nPUBLISH: ${failed.length === 0 ? 'DONE' : 'INCOMPLETE'} (${ok}/${targets.length} published)`)
if (failed.length) {
  for (const f of failed) console.log(`  - ${f.name}: ${f.code} ${f.message ?? ''}`)
  process.exitCode = 1
}
