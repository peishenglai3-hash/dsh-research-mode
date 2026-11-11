// W02-S1-04 supplementary static check (read-only, zero dependencies).
//
// This does NOT prove the skills are semantically correct — the directive is explicit that
// keyword checks cannot establish meaning. It only guards the mechanical contract:
//   1. every `research_*` name a skill mentions is actually registered;
//   2. the four sources that have no tool appear ONLY in the explicit "not available" line;
//   3. both inspected skills offer the `persistent_output: none` exit;
//   4. `skills/` and `.agents/skills/` are byte-identical (no mirror drift).
//
//   node tools/w01/s1-check-skill-contracts.mjs
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

const REGISTERED = new Set([
  'research_project_create', 'research_project_list', 'research_artifact_record', 'research_artifact_list',
  'research_provenance_get', 'research_review_record', 'research_review_verify', 'research_review_list',
  'research_science_export', 'research_science_import',
  'research_worldbank_indicator', 'research_datacite_search', 'research_ilostat_data', 'research_socarxiv_search',
  'research_pku_dataverse_search', 'research_nbs_snapshot', 'research_openalex_search', 'research_crossref_search',
  'research_litdb_search', 'research_litdb_snapshot', 'research_notebook_inspect', 'research_replay_plan',
  'research_notebook_execute', 'research_replay_execute',
])

const INSPECTED = ['literature-review', 'research-review']
const UNAVAILABLE_SOURCES = ['AI4Scholar', 'PubMed', 'Semantic Scholar', 'arXiv']
const NOT_AVAILABLE_MARK = '当前没有对应工具的来源'

let failures = 0
function check(id, ok, detail) {
  if (!ok) failures += 1
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} — ${detail}`)
}

for (const skill of INSPECTED) {
  const path = join(repoRoot, 'skills', skill, 'SKILL.md')
  const text = readFileSync(path, 'utf8')
  const names = [...new Set((text.match(/research_[a-z0-9_]+/g) ?? []))]
  const unknown = names.filter((n) => !REGISTERED.has(n))
  check(`tool-names-known:${skill}`, unknown.length === 0,
    `${names.length} referenced; unknown=[${unknown.join(',')}]`)

  const lines = text.split('\n')
  const badLines = []
  for (const line of lines) {
    if (line.includes(NOT_AVAILABLE_MARK)) continue
    for (const source of UNAVAILABLE_SOURCES) {
      // 'arXiv' occurs inside 'SocArXiv'; require a standalone token so the real
      // connector name is never flagged.
      const hit = /^[A-Za-z0-9]+$/.test(source)
        ? new RegExp(`(?<![A-Za-z0-9])${source}(?![A-Za-z0-9])`).test(line)
        : line.includes(source)
      if (hit) badLines.push(`${source}@${line.slice(0, 40)}`)
    }
  }
  check(`unavailable-sources-quarantined:${skill}`, badLines.length === 0,
    badLines.length === 0 ? 'only in the explicit unavailable line' : `leaked: ${badLines.join(' | ')}`)

  check(`persistent-output-none:${skill}`, text.includes('persistent_output: none'),
    text.includes('persistent_output: none') ? 'exit documented' : 'missing the no-persist exit')
}

// Mirror drift guard across all skill files.
function walk(dir, base = dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry)
    if (statSync(abs).isDirectory()) out.push(...walk(abs, base))
    else out.push(relative(base, abs).replace(/\\/g, '/'))
  }
  return out
}
const skillMirror = join(repoRoot, '.agents', 'skills')
if (!existsSync(skillMirror)) {
  check('mirror-identical', true, 'SKIPPED: no .agents/skills in this checkout (single-copy layout is valid)')
} else {
  const left = walk(join(repoRoot, 'skills')).sort()
  const right = walk(join(repoRoot, '.agents', 'skills')).sort()
  const sameList = JSON.stringify(left) === JSON.stringify(right)
  const differing = []
  if (sameList) {
    for (const rel of left) {
      const a = createHash('sha256').update(readFileSync(join(repoRoot, 'skills', rel))).digest('hex')
      const b = createHash('sha256').update(readFileSync(join(repoRoot, '.agents', 'skills', rel))).digest('hex')
      if (a !== b) differing.push(rel)
    }
  }
  check('mirror-identical', sameList && differing.length === 0,
    sameList ? `${left.length} files, differing=${differing.length}` : 'file lists differ')
}

// Cross-check the hardcoded registry against what the bundles actually declare. This used to
// live inside the `else` above, so in a checkout without .agents/skills — which is the published
// layout — it never ran at all: a registered tool could be deleted or renamed and the check still
// passed (independent QA reproduced that).
//
// Limitation, stated rather than hidden: this asserts that each registered name still appears
// somewhere in the bundle sources. It catches removal. It does not catch a rename that leaves the
// old name behind in a message or comment (renaming research_replay_plan's `name:` line while the
// error string still says "research_replay_plan …" passes). The bundle registration forms differ
// (object `name:` in the phase-2 tools, bare string literals in host/connectors), so a precise
// registration-level check needs the host to expose the mounted tool list — that is the real fix,
// not a regex.
const declared = new Set()
for (const bundle of readdirSync(join(repoRoot, 'plugins', 'active'))) {
  const dir = join(repoRoot, 'plugins', 'active', bundle)
  if (!statSync(dir).isDirectory()) continue
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.js')) continue
    const text = readFileSync(join(dir, file), 'utf8')
    for (const m of text.matchAll(/research_[a-z0-9_]+/g)) declared.add(m[0])
  }
}
const missingFromSource = [...REGISTERED].filter((n) => !declared.has(n))
check('registry-matches-sources', missingFromSource.length === 0,
  missingFromSource.length === 0 ? `all ${REGISTERED.size} names appear in plugins/active` : `absent from source: ${missingFromSource.join(',')}`)
console.log(`\nSKILL CONTRACT CHECK: ${failures === 0 ? 'PASS' : 'FAIL'} (${failures} failure(s))`)
if (failures > 0) process.exitCode = 1
