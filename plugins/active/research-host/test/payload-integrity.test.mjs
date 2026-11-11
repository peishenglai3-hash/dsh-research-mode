// Gate: a content-addressed artifact's identity must be checked against the bytes, not
// only reported from the sidecar.
//
// Before this test, `getProvenance` read only `artifacts/<id>.json` and echoed the recorded
// checksum. Appending a byte to the payload left the answer unchanged, so a tampered payload
// still read as "reproducibility: available" with the original checksum. Export did not catch
// it either: the manifest is rebuilt from whatever bytes are on disk at export time, so a
// tampered project produced a self-consistent archive. Import *does* verify — the check
// existed at the door but not at the window.
import assert from 'node:assert/strict'
import test from 'node:test'
import { appendFile, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { createProject, exportScience, getProvenance, recordArtifact, recordReview } from '../lib/store.js'

async function setup() {
  const workspace = await mkdtemp(join(tmpdir(), 'research-integrity-'))
  const created = await createProject(workspace, { name: 'integrity' })
  const projectId = created.project.id
  const recorded = await recordArtifact(workspace, projectId, {
    title: 'note.md', kind: 'note', content: 'claim A -> anchor #/texts/0\n',
  })
  const payloadPath = join(workspace, '.research', 'projects', projectId, 'artifacts', recorded.artifact.id)
  return { workspace, projectId, id: recorded.artifact.id, payloadPath, bytes: recorded.artifact.bytes }
}

test('an intact payload verifies against the recorded id', async () => {
  const { workspace, projectId, id, bytes } = await setup()
  try {
    const provenance = await getProvenance(workspace, projectId, id)
    assert.equal(provenance.payloadVerified, true)
    assert.equal(provenance.payloadBytes, bytes)
    assert.equal(provenance.checksum.value, id)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('a tampered payload is reported as not verified, and the recorded checksum is not rewritten', async () => {
  const { workspace, projectId, id, payloadPath } = await setup()
  try {
    const before = await getProvenance(workspace, projectId, id)
    const appended = 'TAMPERED EXTRA BYTES\n'
    await appendFile(payloadPath, appended)
    const provenance = await getProvenance(workspace, projectId, id)
    assert.equal(provenance.payloadVerified, false, 'bytes no longer hash to the recorded id')
    assert.equal(provenance.payloadBytes, before.payloadBytes + appended.length)
    // The immutable sidecar still reports what was recorded; the new field reports what is true.
    assert.equal(provenance.checksum.value, id)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('a deleted payload is reported as not verified instead of throwing', async () => {
  const { workspace, projectId, id, payloadPath } = await setup()
  try {
    await unlink(payloadPath)
    const provenance = await getProvenance(workspace, projectId, id)
    assert.equal(provenance.payloadVerified, false)
    assert.equal(provenance.payloadBytes, null)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('export refuses a payload whose bytes no longer match its id', async () => {
  const { workspace, projectId, payloadPath } = await setup()
  try {
    const intact = await exportScience(workspace, projectId, { name: 'intact' })
    assert.ok(intact.bytes > 0, 'an untouched project still exports')
    await appendFile(payloadPath, 'TAMPERED EXTRA BYTES\n')
    // Without this guard the manifest is rebuilt around the tampered bytes, so the archive
    // verifies perfectly on import — the tamper would be laundered, not reported.
    await assert.rejects(
      () => exportScience(workspace, projectId, { name: 'tampered' }),
      /no longer match their id/,
    )
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('the derived review face reports whether the signature was actually checked', async () => {
  const { workspace, projectId, id } = await setup()
  try {
    await recordReview(workspace, projectId, id, { decision: 'accept', notes: 'ok', reviewer: 'qa' })
    const intact = await getProvenance(workspace, projectId, id)
    assert.equal(intact.faces.review.status, 'available')
    assert.equal(intact.faces.review.signatureValid, true)
    assert.match(intact.faces.review.signatureMeaning, /unkeyed content hash/)

    // Edit the recorded round without re-signing it: provenance must not keep saying the
    // signature is fine. Independent QA found that the face copied the signature without
    // ever checking it, so it could report "available / accept" for a record verifyReview
    // rejects.
    const reviewPath = join(workspace, '.research', 'projects', projectId, 'reviews', `${id}.json`)
    const record = JSON.parse(await readFile(reviewPath, 'utf8'))
    if (Array.isArray(record.history) && record.history.length > 0) record.history[record.history.length - 1].decision = 'reject'
    else record.decision = 'reject'
    await writeFile(reviewPath, JSON.stringify(record), 'utf8')

    const tampered = await getProvenance(workspace, projectId, id)
    assert.equal(tampered.faces.review.signatureValid, false)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})
