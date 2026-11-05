// Generate the profile composition matrix: what a real `--dump-config` composes vs what
// this repository actually ships.
//
// Why a generator instead of a hand-written table: the install guide must not drift from
// the profile it documents. The matrix comes from a live composed tree plus the bundles on
// disk, and the JSON form is meant to be diffed against a known-good baseline.
//
//   node tools/release/profile-composition.mjs --profile w02-alpha
//   node tools/release/profile-composition.mjs --profile w02-alpha --from dump.txt
//   node tools/release/profile-composition.mjs --profile w02-alpha --dsh "C:/path/dsh.cmd"
//
// Read-only apart from writing docs/PROFILE-COMPOSITION.md and docs/profile-composition.json.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const profile = arg('profile', 'w02-alpha')
const dsh = arg('dsh', process.env.DSH_CLI || 'dsh')

// --- bundles this repository actually ships ---------------------------------
const bundleDir = join(repoRoot, 'plugins', 'active')
const shipped = new Map()
for (const name of readdirSync(bundleDir)) {
  const pkgPath = join(bundleDir, name, 'package.json')
  try {
    if (!statSync(pkgPath).isFile()) continue
  } catch { continue }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  shipped.set(pkg.name, { dir: `plugins/active/${name}`, version: pkg.version, hasBundle: Boolean(pkg.dsh?.bundle) })
}

// --- obtain the composed tree ------------------------------------------------
const fromFile = arg('from', null)
let tree
if (fromFile) {
  // PowerShell's `>` writes UTF-16LE; a UTF-8 decode would "succeed" with zero bundles
  // instead of erroring. Decode by BOM, and refuse an empty parse below.
  const bytes = readFileSync(fromFile)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) tree = bytes.subarray(2).toString('utf16le')
  else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) tree = bytes.subarray(3).toString('utf8')
  else tree = bytes.toString('utf8')
} else {
  try {
    if (/\.(cmd|bat)$/i.test(dsh)) {
      // Node 24 refuses to spawn a .cmd directly (EINVAL); go through ComSpec.
      tree = execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${dsh}" --dump-config --profile ${profile}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    } else {
      tree = execFileSync(dsh, ['--dump-config', '--profile', profile], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    }
  } catch (error) {
    console.error(`failed to run "${dsh} --dump-config --profile ${profile}": ${error.message}`)
    process.exit(2)
  }
}

// --- parse -------------------------------------------------------------------
// Header grammar: `# == <bundle>` or `# == <bundle>, patched by <source>`.
// The same bundle can appear many times (once per patched section), so accumulate by name.
const bundles = new Map()
const patchedBy = new Map()
let current = null

for (const raw of tree.split(/\r?\n/)) {
  const header = raw.match(/^#\s*==\s*(.+?)\s*(?:,\s*patched by\s+(.+?))?\s*$/)
  if (header) {
    const name = header[1].trim()
    const patch = header[2] ? header[2].trim() : null
    if (!bundles.has(name)) bundles.set(name, [])
    if (patch) patchedBy.set(name, patch)
    current = name
    continue
  }
  const rowId = raw.match(/^-\s+id:\s*(\S+)\s*$/)
  if (rowId && current) bundles.get(current).push(rowId[1])
}

// A bundle the harness refused to resolve is reported on stderr, which may or may not be in
// the capture. Surface it rather than silently showing a healthy-looking composition.
const skipped = []
for (const line of tree.split(/\r?\n/)) {
  const m = line.match(/skipping profile bundle "([^"]+)"(?:.*?):\s*(.*)$/)
  if (m) skipped.push({ bundle: m[1], reason: (m[2] || '').slice(0, 200) })
}

if (bundles.size === 0) {
  console.error('parsed zero bundles from the composed tree — refusing to emit an empty matrix')
  console.error('the input is probably not a --dump-config capture, or is in an unexpected encoding')
  process.exit(3)
}

// --- classify ----------------------------------------------------------------
const HOST_PREFIX = '@deepseek-ai/'
const isProfilePatch = (name) => /[\\/]cordis\.patch\.ya?ml$/i.test(name) || /\.ya?ml$/i.test(name)

// This file is published, so nothing it writes may contain a local absolute path.
const HOME = process.env.USERPROFILE || process.env.HOME || ''
function scrub(text) {
  let out = String(text)
  if (HOME) {
    out = out.split(HOME).join('<home>')
    out = out.split(HOME.replace(/\\/g, '/')).join('<home>')
  }
  out = out.replace(/[A-Za-z]:[\\/]DSH-Projects[\\/][^\\/\s"']+/g, '<workspace>')
  out = out.replace(/[A-Za-z]:[\\/]Users[\\/][^\\/\s"']+/g, '<home>')
  return out
}

function displayName(name) {
  if (isProfilePatch(name)) return '<profile>/cordis.patch.yml'
  return scrub(name)
}

function classify(name) {
  if (isProfilePatch(name)) return { kind: 'profile-patch' }
  if (shipped.has(name)) return { kind: 'in-repo', ...shipped.get(name) }
  if (name.startsWith(HOST_PREFIX)) return { kind: 'host-provided' }
  return { kind: 'external' }
}

const matrix = [...bundles.entries()].map(([rawName, rows]) => {
  const name = displayName(rawName)
  const c = classify(name)
  return {
    bundle: name,
    kind: c.kind,
    version: c.version ?? null,
    path: c.dir ?? null,
    hasBundleManifest: c.hasBundle ?? null,
    patchedBy: patchedBy.has(rawName) ? scrub(patchedBy.get(rawName)) : null,
    rowCount: rows.length,
    rows,
  }
})

const summary = {
  profile,
  generatedFrom: fromFile ? `captured --dump-config output (${fromFile.split(/[\\/]/).pop()})` : `dsh --dump-config --profile ${profile}`,
  totals: {
    composedBundles: matrix.length,
    inRepo: matrix.filter((m) => m.kind === 'in-repo').length,
    hostProvided: matrix.filter((m) => m.kind === 'host-provided').length,
    external: matrix.filter((m) => m.kind === 'external').length,
    profilePatch: matrix.filter((m) => m.kind === 'profile-patch').length,
  },
  bundles: matrix,
  skippedBundles: skipped,
  warnings: [],
}

for (const m of matrix.filter((x) => x.kind === 'external')) {
  summary.warnings.push(`${m.bundle} is composed but is NOT shipped by this repository`)
}
for (const m of matrix.filter((x) => x.kind === 'in-repo' && x.hasBundleManifest === false)) {
  summary.warnings.push(`${m.bundle} has no dsh.bundle manifest and cannot be installed as a bundle`)
}
for (const s of skipped) {
  summary.warnings.push(`${s.bundle} was SKIPPED by the harness: ${scrub(s.reason)}`)
}

const KIND_LABEL = {
  'in-repo': '**in repo**',
  'host-provided': 'host',
  external: '**external**',
  'profile-patch': 'profile patch',
}

const rows = matrix
  .map((m) => `| \`${m.bundle}\` | ${m.rowCount} | ${KIND_LABEL[m.kind]} | ${m.version ?? '—'} | ${m.path ?? (m.patchedBy ? 'patched by host' : '—')} |`)
  .join('\n')

const doc = `# Profile composition

Generated by \`tools/release/profile-composition.mjs\` — **do not edit by hand**.
Input: \`${summary.generatedFrom}\`, compared against \`plugins/active/*/package.json\`.

This document exists so that "it works on my machine" can be checked against what a profile
actually composes, per bundle, instead of being asserted in prose.

## Totals

| | count |
|---|---:|
| composed bundles | ${summary.totals.composedBundles} |
| shipped by this repository | ${summary.totals.inRepo} |
| provided by the harness | ${summary.totals.hostProvided} |
| profile-level patch rows | ${summary.totals.profilePatch} |
| **present but not in this repository** | **${summary.totals.external}** |

## Row by row

| bundle | rows | where it comes from | version | path |
|---|---:|---|---|---|
${rows}

## Reading the matrix

- **in repo** — \`plugins/active/\`, so a clone reproduces it with \`link:\` dependencies.
- **host** — shipped by the harness itself, not by this repository.
- **profile patch** — the profile's own \`cordis.patch.yml\` (user layer), not a bundle.
- **external** — composed but absent here. A profile carrying one of these is **not**
  fully reproducible from a clone; the table says so instead of hiding it.

${summary.warnings.length ? `## Warnings\n\n${summary.warnings.map((w) => `- ⚠ ${w}`).join('\n')}` : '## Warnings\n\n- none'}

## Machine-readable form

\`docs/profile-composition.json\` carries the same data plus every row id, so CI can diff the
composition against a known-good baseline.
`

writeFileSync(join(repoRoot, 'docs', 'PROFILE-COMPOSITION.md'), doc, 'utf8')
writeFileSync(join(repoRoot, 'docs', 'profile-composition.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8')

// Self-check: a published document must not contain local absolute paths.
const emitted = readFileSync(join(repoRoot, 'docs', 'PROFILE-COMPOSITION.md'), 'utf8') +
  readFileSync(join(repoRoot, 'docs', 'profile-composition.json'), 'utf8')
// The home directory's basename is taken from the environment at run time rather than written
// here: hardcoding it would put the very identifier this guard looks for into a public file.
const homeName = HOME ? HOME.split(/[\\/]/).filter(Boolean).pop() : ''
const leakPatterns = [/[A-Za-z]:[\\/]Users[\\/]/, /[A-Za-z]:[\\/]DSH-Projects/]
if (homeName && homeName.length >= 3) leakPatterns.push(new RegExp(`\\b${homeName}\\b`))
const leaks = leakPatterns.filter((re) => re.test(emitted)).map(String)
if (leaks.length) {
  console.error('refusing: generated docs contain local absolute paths: ' + leaks.join(', '))
  process.exit(4)
}

console.log(JSON.stringify({ ok: true, ...summary.totals, skipped: summary.skippedBundles, warnings: summary.warnings, bundles: matrix.map((m) => `${m.kind}:${m.bundle}`) }, null, 2))
