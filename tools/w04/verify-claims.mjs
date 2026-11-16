// Claim-fidelity check for a claim ledger.
//
// What this proves: every claim cites an anchor that exists in the recorded parse, and its quote
// occurs VERBATIM in that anchor. That is fidelity — the claim is not misquoting its source.
//
// What this does NOT prove: that the claim is true, that the quote supports it, or that the parser
// was right. A perfectly quoted sentence can still be a bad inference. Treat PASS as "the citation
// can be checked", never as "the claim is correct".
//
//   node tools/w04/verify-claims.mjs
//   node tools/w04/verify-claims.mjs --ledger <path> --parse <path>
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const ledgerPath = arg('ledger', join(here, 'fixtures', 'claim-ledger.json'))
const parsePath = arg('parse', join(repoRoot, 'tools', 'w03', 'fixtures', 'reading-parse.json'))
const pdfPath = arg('pdf', join(repoRoot, 'tools', 'w03', 'fixtures', 'synthetic-2page.pdf'))

const STRENGTHS = new Set(['quoted', 'paraphrased', 'inferred', 'reported'])

let failures = 0
function check(name, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'))
const parse = JSON.parse(await readFile(parsePath, 'utf8'))
const pdf = await readFile(pdfPath)
const anchors = new Map((parse.anchors ?? []).map((a) => [a.id, a]))

// 0. The ledger must be about the same source it claims, and the parse must be about that source.
const pdfSha = createHash('sha256').update(pdf).digest('hex')
check('ledger declares a schema', typeof ledger.schema === 'string' && ledger.schema.startsWith('research/claim-ledger/'), String(ledger.schema))
check('parse fixture is bound to the source PDF', parse.sourceSha256 === pdfSha, `${String(parse.sourceSha256).slice(0, 16)} vs ${pdfSha.slice(0, 16)}`)
check('ledger source hash matches the parse', ledger.sourceSha256 === parse.sourceSha256)

// 1. Structural checks.
const claims = Array.isArray(ledger.claims) ? ledger.claims : []
check('ledger has at least one claim', claims.length > 0, `${claims.length} claim(s)`)
const ids = new Set()
for (const claim of claims) {
  const id = String(claim.id ?? '(no id)')
  check(`claim ${id} has non-empty text`, typeof claim.text === 'string' && claim.text.trim().length > 0)
  check(`claim ${id} has a unique id`, !ids.has(id), ids.has(id) ? 'duplicate' : '')
  ids.add(id)
  check(`claim ${id} declares a known strength`, STRENGTHS.has(claim.strength), String(claim.strength))
  check(`claim ${id} declares a scope`, typeof claim.scope === 'string' && claim.scope.trim().length > 0)
}

// 2. Fidelity: the anchor exists and the quote occurs in it verbatim.
for (const claim of claims) {
  const anchor = anchors.get(claim.anchor)
  check(`claim ${claim.id} cites an existing anchor`, Boolean(anchor), String(claim.anchor))
  if (!anchor) continue
  const quote = String(claim.quote ?? '')
  check(`claim ${claim.id} quote is non-empty`, quote.length > 0)
  check(`claim ${claim.id} quote occurs verbatim at ${claim.anchor}`, anchor.text.includes(quote), quote.slice(0, 60))
}

// 3. Negative control: the same checks must reject a fabricated quote. Without this, a checker
//    that always prints PASS would look identical to a working one.
const fabricated = { id: 'NEG', anchor: claims[0]?.anchor, quote: 'Finding Z: this sentence does not exist in the source.' }
const negAnchor = anchors.get(fabricated.anchor)
const negPassed = Boolean(negAnchor) && negAnchor.text.includes(fabricated.quote)
check('negative control: a fabricated quote is rejected', negPassed === false, negPassed ? 'checker is vacuous' : 'correctly rejected')

console.log('')
console.log(`CLAIM LEDGER: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`)
console.log('scope: quote fidelity against the recorded parse. It does not judge whether the claim is')
console.log('true, nor whether the parser was right — see docs/w04/W04-PLAN.md §4 E1.')
process.exit(failures === 0 ? 0 : 1)
