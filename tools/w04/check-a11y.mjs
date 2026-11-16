// Static a11y contract for the research hub panel.
//
// This is deliberately narrow: it checks the parts of WAI-ARIA that a text search can decide —
// that the view switcher is a tablist whose tabs carry aria-selected, that the content region is
// labelled by the active tab, and that async errors announce themselves. It cannot check focus
// order, contrast, or what a screen reader actually says; those need a browser and a person.
//
// The negative control matters more than the checks: a copy with the tablist removed must FAIL,
// otherwise "PASS" would only mean the file exists.
//
//   node tools/w04/check-a11y.mjs
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const hubClient = join(repoRoot, 'plugins', 'active', 'research-hub', 'client.js')

let failures = 0
function check(name, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

function contract(source) {
  return {
    tablist: source.includes("role: 'tablist'"),
    tab: source.includes("role: 'tab'"),
    selected: source.includes("'aria-selected'"),
    tabpanel: source.includes("role: 'tabpanel'"),
    labelledBy: source.includes("'aria-labelledby'"),
    liveRegion: source.includes("'aria-live'"),
    refreshLabel: source.includes("'aria-label': 'refresh research hub'"),
  }
}

const source = await readFile(hubClient, 'utf8')
const ok = contract(source)
for (const [key, passed] of Object.entries(ok)) {
  check(`hub client satisfies ${key}`, passed)
}

// Negative control: strip the tablist role from an in-memory copy and re-run the same contract.
const broken = source.replace("role: 'tablist'", "role: 'group'")
const brokenContract = contract(broken)
check('negative control: removing the tablist role is detected', brokenContract.tablist === false,
  brokenContract.tablist ? 'checker is vacuous' : 'correctly rejected')

console.log('')
console.log(`A11Y CONTRACT: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`)
console.log('scope: static ARIA contract only. Focus order, contrast and screen-reader behaviour are')
console.log('not checked here — see docs/w04/W04-PLAN.md §4 E6.')
process.exit(failures === 0 ? 0 : 1)
