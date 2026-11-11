// Cross-platform test entry: enumerates test files itself and hands `node --test` an explicit
// list. Two reasons this exists instead of `node --test plugins/active/*/test/*.test.mjs`:
//
//   1. the shell in CI may not expand globs (pwsh on the Windows runner does not), and
//   2. `node --test <dir>` is not available on the Node build this repository targets, so the
//      directory form silently does nothing useful.
//
// It prints the exact file list it ran, so a "66 tests" claim can be checked against what
// actually executed rather than against a number in a README.
//
//   node tools/w03/run-tests.mjs
//   node tools/w03/run-tests.mjs --list      # print files, run nothing
import { readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const activeDir = join(repoRoot, 'plugins', 'active')

const files = []
for (const bundle of readdirSync(activeDir).sort()) {
  const testDir = join(activeDir, bundle, 'test')
  let entries = []
  try {
    if (!statSync(testDir).isDirectory()) continue
    entries = readdirSync(testDir).sort()
  } catch {
    continue
  }
  for (const entry of entries) {
    if (!entry.endsWith('.test.mjs')) continue
    files.push(join(testDir, entry))
  }
}

if (files.length === 0) {
  console.error('no test files found under plugins/active/*/test — refusing to report success')
  process.exit(3)
}

console.log(`test files (${files.length}):`)
for (const file of files) console.log(`  ${relative(repoRoot, file)}`)

if (process.argv.includes('--list')) process.exit(0)

// Pass an explicit list. `windowsHide` keeps the CI log clean; stdio 'inherit' keeps the
// reporter output intact.
const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: repoRoot,
  stdio: 'inherit',
  windowsHide: true,
})

if (result.error) {
  console.error(`failed to spawn node --test: ${result.error.message}`)
  process.exit(2)
}
process.exit(result.status ?? 1)
