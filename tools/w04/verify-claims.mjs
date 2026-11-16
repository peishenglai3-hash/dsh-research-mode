// Claim-fidelity check for a claim ledger, plus a labelled gold set.
//
// What this proves: every claim cites an anchor that exists in the recorded parse, and its quote
// occurs VERBATIM in that anchor. That is fidelity — the claim is not misquoting its source.
//
// What this does NOT prove: that the claim is true, that the quote supports it, or that the parser
// was right. A perfectly quoted sentence can still be a bad inference. Treat PASS as "the citation
// can be checked", never as "the claim is correct".
//
//   node tools/w04/verify-claims.mjs                 # check the fixture ledger
//   node tools/w04/verify-claims.mjs --gold          # run the 10-case gold set
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const STRENGTHS = new Set(['quoted', 'paraphrased', 'inferred', 'reported'])

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

// Pure: returns the list of failed check names for one ledger against one parse.
export function validateLedger(ledger, parse, pdfSha) {
  const failures = []
  const fail = (name) => failures.push(name)
  const anchors = new Map((parse.anchors ?? []).map((a) => [a.id, a]))

  if (!(typeof ledger.schema === 'string' && ledger.schema.startsWith('research/claim-ledger/'))) fail('schema')
  if (parse.sourceSha256 !== pdfSha) fail('parse-bound-to-source')
  if (ledger.sourceSha256 !== parse.sourceSha256) fail('ledger-source-hash')

  const claims = Array.isArray(ledger.claims) ? ledger.claims : []
  if (claims.length === 0) fail('has-claims')
  const ids = new Set()
  for (const claim of claims) {
    const id = String(claim.id ?? '')
    if (!(typeof claim.text === 'string' && claim.text.trim())) fail(`text:${id}`)
    if (!id || ids.has(id)) fail(`unique-id:${id}`)
    ids.add(id)
    if (!STRENGTHS.has(claim.strength)) fail(`strength:${id}`)
    if (!(typeof claim.scope === 'string' && claim.scope.trim())) fail(`scope:${id}`)
    const anchor = anchors.get(claim.anchor)
    if (!anchor) { fail(`anchor:${id}`); continue }
    const quote = String(claim.quote ?? '')
    if (!quote) fail(`quote-empty:${id}`)
    else if (!anchor.text.includes(quote)) fail(`quote-verbatim:${id}`)
  }
  return failures
}

const goldMode = process.argv.includes('--gold')
const ledgerPath = arg('ledger', join(here, 'fixtures', 'claim-ledger.json'))
const casesPath = arg('cases', join(here, 'fixtures', 'claim-cases.json'))
const parsePath = arg('parse', join(repoRoot, 'tools', 'w03', 'fixtures', 'reading-parse.json'))
const pdfPath = arg('pdf', join(repoRoot, 'tools', 'w03', 'fixtures', 'synthetic-2page.pdf'))

const parse = JSON.parse(await readFile(parsePath, 'utf8'))
const pdfSha = createHash('sha256').update(await readFile(pdfPath)).digest('hex')
let failures = 0
function check(name, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

if (goldMode) {
  // Ten labelled cases: six that must pass, four that must fail for a specific reason. This tests
  // the checker, not the parser — a checker that always said PASS would fail half of them.
  const casesFile = JSON.parse(await readFile(casesPath, 'utf8'))
  const cases = Array.isArray(casesFile) ? casesFile : casesFile.cases
  for (const c of cases) {
    const found = validateLedger(c.ledger, parse, pdfSha)
    const passed = found.length === 0
    const expectedPass = c.expect === 'pass'
    const verdict = passed === expectedPass
    check(`${c.id}: expected ${c.expect}${c.reason ? ` (${c.reason})` : ''}`, verdict,
      verdict ? '' : `got ${passed ? 'pass' : `fail:${found.join(',')}`}`)
  }
} else {
  const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'))
  const found = validateLedger(ledger, parse, pdfSha)
  check('fixture ledger satisfies the contract', found.length === 0, found.join(',') || '')

  // Negative control: the same validation must reject a fabricated quote. Without this, a checker
  // that always prints PASS would look identical to a working one.
  const fabricated = {
    ...ledger,
    claims: [{ ...(ledger.claims?.[0] ?? {}), id: 'NEG', quote: 'Finding Z: this sentence does not exist in the source.' }],
  }
  const neg = validateLedger(fabricated, parse, pdfSha)
  check('negative control: a fabricated quote is rejected', neg.some((n) => n.startsWith('quote-verbatim')), neg.join(',') || 'checker is vacuous')
}

console.log('')
console.log(`CLAIM LEDGER: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`)
console.log(goldMode
  ? 'scope: the labelled gold set exercises the checker; it says nothing about any real paper.'
  : 'scope: quote fidelity against the recorded parse. It does not judge whether the claim is true.')
process.exit(failures === 0 ? 0 : 1)
