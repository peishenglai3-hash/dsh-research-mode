// The reading-evidence loop, made runnable.
//
// What this proves, and what it deliberately does not:
//
//   PROVES  a reading note whose locators can be checked against the parsed source really can be
//           recorded as an immutable artifact, and read back with verified bytes. The quote check
//           is exact-substring against the parser output, so a note that invents a quote fails.
//   DOES NOT prove the parser is reachable in a product session. That is a separate, measured
//           fact (docs/w03/findings/lead-probes.md P-07): Docling's MCP conversion succeeded at
//           115 s and 317 s for the same two-page file, and exposed anchors but no page numbers.
//
// The fixture is the parser's *output*, not the parser, which is why this can run in CI. The
// parser stays an external dependency whose latency and granularity are documented rather than
// hidden behind a green check.
//
//   node tools/w03/verify-reading-loop.mjs
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

import { createProject, getProvenance, recordArtifact, sha256 } from '../../plugins/active/research-host/lib/store.js'

const here = dirname(fileURLToPath(import.meta.url))
let failures = 0
function check(name, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

const pdfBytes = await readFile(join(here, 'fixtures', 'synthetic-2page.pdf'))
const parseBytes = await readFile(join(here, 'fixtures', 'reading-parse.json'))
const parse = JSON.parse(parseBytes.toString('utf8'))
const anchorById = new Map(parse.anchors.map((anchor) => [anchor.id, anchor]))

// 1. The source is content-addressed before anything is read out of it, and the parse is bound
//    to that exact source. Without this binding the fixture proved nothing about the PDF: an
//    earlier version only hashed the PDF and checked quotes against the parse, so replacing the
//    PDF with unrelated bytes still passed (independent QA reproduced that).
const sourceSha = sha256(pdfBytes)
check('source PDF has a stable sha256', /^[0-9a-f]{64}$/.test(sourceSha), sourceSha.slice(0, 16))
check('the recorded parse declares this exact source', parse.sourceSha256 === sourceSha,
  parse.sourceSha256 ? String(parse.sourceSha256).slice(0, 16) : 'missing sourceSha256')

// Each anchor carries a marker that must also be present in the source bytes. This is what makes
// swapping the source observable: the fixture's streams are uncompressed, so the marker is
// literally in the PDF. On a parser output that is not true of real PDFs, and the check is
// scoped to this fixture on purpose.
const sourceText = pdfBytes.toString('latin1')
for (const anchor of parse.anchors) {
  const marker = (String(anchor.text).match(/ANCHOR-[A-Z0-9-]+/) || [])[0]
  check(`anchor ${anchor.id} is bound to the source bytes`, Boolean(marker) && sourceText.includes(marker), marker ?? 'no ANCHOR-* marker')
}


// 2. A note is only allowed to claim what the parser actually contains: every quote must be an
//    exact substring of the anchor it cites. This is the minimal, deterministic version of
//    "does the source support the claim" — not a judgement about truth, only about fidelity.
const claims = [
  { claim: 'the fixture asserts an intermediate-organisation deficit', anchor: '#/texts/0', quote: 'Finding A: intermediate-organisation deficit is the core of social atomisation.' },
  { claim: 'the fixture distinguishes mobility from a definition', anchor: '#/texts/1', quote: 'Finding B: population mobility is one mechanism, not a definition.' },
]
for (const item of claims) {
  const anchor = anchorById.get(item.anchor)
  check(`quote is present verbatim at ${item.anchor}`, Boolean(anchor) && anchor.text.includes(item.quote))
}
const negative = anchorById.get('#/texts/0').text.includes('Finding Z: a sentence that is not in the source')
check('a fabricated quote is rejected by the same check (negative control)', negative === false)

// 3. Record the note as an artifact, carrying the locators in the literature face.
const note = [
  '# Reading note — synthetic fixture',
  '',
  `source sha256: ${sourceSha}`,
  '',
  ...claims.map((item) => `- ${item.claim}\n  - anchor: ${item.anchor}\n  - quote: "${item.quote}"`),
  '',
].join('\n')

const workspace = await mkdtemp(join(tmpdir(), 'w03-reading-'))
try {
  const { project } = await createProject(workspace, { name: 'reading-loop' })
  const recorded = await recordArtifact(workspace, project.id, {
    title: 'reading-note.md',
    kind: 'reading-note',
    content: note,
    literature: JSON.stringify({
      source: parse.source,
      sourceSha256: sourceSha,
      parseSha256: sha256(parseBytes),
      parser: 'docling (external; MCP conversion measured 115–317 s, anchors only)',
      anchors: claims.map((item) => ({ id: item.anchor, page: anchorById.get(item.anchor)?.page ?? null, quote: item.quote })),
    }),
  })

  check('artifact id is the sha256 of the note bytes', recorded.artifact.id === sha256(Buffer.from(note, 'utf8')))
  check('artifact is immutable by construction (same bytes dedupe)', recorded.created === true)
  check('note size stays inside an operational limit', recorded.artifact.bytes < 256 * 1024, `${recorded.artifact.bytes} B`)

  const provenance = await getProvenance(workspace, project.id, recorded.artifact.id)
  const literature = provenance.faces.literature
  check('literature face is available', literature?.status === 'available')
  const parsedLiterature = JSON.parse(literature.value)
  check('literature face carries the source hash', parsedLiterature.sourceSha256 === sourceSha)
  check('literature face carries both anchors', parsedLiterature.anchors.length === claims.length)
  check('read-back reports the payload matches its id', provenance.payloadVerified === true)
  check('read-back reports the recorded checksum', provenance.checksum.value === recorded.artifact.id)
} finally {
  await rm(workspace, { recursive: true, force: true })
}

console.log('')
console.log(`READING LOOP: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`)
console.log('scope: evidence layer + locator fidelity. Parser reachability and page-level locators are')
console.log('reported separately in docs/w03/W03-READING-CLOSED-LOOP.md, not asserted here.')
process.exit(failures === 0 ? 0 : 1)
