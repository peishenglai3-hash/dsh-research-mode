// Gate-E acceptance: review round-trip, per-round verification, derived provenance.
//
// These tests are the W01 contract for the evidence layer:
//   1. `reviews/` travels with a `.science` archive and comes back intact.
//   2. every recorded round is verified, so tampering the earliest round is caught.
//   3. a legacy single-record review stays verifiable and is not rebuilt unsigned.
//   4. the review face in provenance is derived at read time; the immutable
//      artifact sidecar is never rewritten.
//   5. an import whose payload no longer matches the manifest is refused.
import assert from 'node:assert/strict'
import test from 'node:test'
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { gunzipSync, gzipSync } from 'node:zlib'

import {
  buildTar, createProject, exportScience, getProvenance, importScience,
  parseTar, recordArtifact, recordReview, sha256, verifyReview,
} from '../lib/store.js'

async function setup() {
  const workspace = await mkdtemp(join(tmpdir(), 'research-review-'))
  const created = await createProject(workspace, { name: '社会原子化', template: 'literature-review' })
  const projectId = created.project.id
  const artifact = await recordArtifact(workspace, projectId, {
    title: '检索日志', kind: 'search-log', content: 'evidence body\n',
  })
  const artifactId = artifact.artifact.id
  return {
    workspace, projectId, artifactId,
    reviewFile: join(workspace, '.research', 'projects', projectId, 'reviews', `${artifactId}.json`),
    sidecarFile: join(workspace, '.research', 'projects', projectId, 'artifacts', `${artifactId}.json`),
  }
}

test('three review rounds survive a .science roundtrip', async () => {
  const { workspace, projectId, artifactId, reviewFile } = await setup()
  try {
    for (const decision of ['accept', 'revise', 'accept']) {
      await recordReview(workspace, projectId, artifactId, { decision, notes: `${decision} round`, reviewer: 'auditor', authority: 'auditor', template: 'evidence' })
    }
    const original = JSON.parse(await readFile(reviewFile, 'utf8'))
    assert.equal(original.history.length, 3)
    assert.equal(original.round, 3)

    const exported = await exportScience(workspace, projectId, { name: 'rounds' })
    const entries = parseTar(gunzipSync(await readFile(join(workspace, exported.path))))
    const names = entries.map((entry) => entry.name)
    assert.ok(names.includes(`payload/reviews/${artifactId}.json`), 'reviews/ must be in the archive')
    assert.ok(
      exported.manifest.files.some((file) => file.path === `reviews/${artifactId}.json`),
      'the manifest must declare the review file',
    )

    const imported = await importScience(workspace, exported.path, { name: 'rounds' })
    const restoredText = await readFile(join(workspace, imported.path, 'payload', 'reviews', `${artifactId}.json`), 'utf8')
    const restored = JSON.parse(restoredText)
    assert.equal(restored.history.length, 3, 'all three rounds must survive')
    assert.deepEqual(restored, original, 'the review file must round-trip byte-equivalently')
    for (const round of restored.history) {
      assert.match(round.signature, /^[0-9a-f]{64}$/)
    }
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('all rounds verify, and tampering the earliest round is reported', async () => {
  const { workspace, projectId, artifactId, reviewFile } = await setup()
  try {
    for (const decision of ['accept', 'revise', 'accept']) {
      await recordReview(workspace, projectId, artifactId, { decision, notes: decision, reviewer: 'auditor' })
    }
    const clean = await verifyReview(workspace, projectId, artifactId)
    assert.equal(clean.roundCount, 3)
    assert.equal(clean.validRounds, 3)
    assert.equal(clean.valid, true)
    assert.deepEqual(clean.rounds.map((round) => round.status), ['valid', 'valid', 'valid'])

    // Tamper round 1 only. A head-only check would still report valid.
    const stored = JSON.parse(await readFile(reviewFile, 'utf8'))
    stored.history[0].decision = 'reject'
    await writeFile(reviewFile, `${JSON.stringify(stored, null, 2)}\n`, 'utf8')

    const tampered = await verifyReview(workspace, projectId, artifactId)
    assert.equal(tampered.valid, false)
    assert.deepEqual(tampered.rounds.map((round) => round.status), ['invalid', 'valid', 'valid'])
    assert.equal(tampered.rounds[0].round, 1)
    assert.match(tampered.limitations.join(' '), /not a Merkle log/)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('a legacy single-record review stays verifiable and appends without losing fields', async () => {
  const { workspace, projectId, artifactId, reviewFile } = await setup()
  try {
    await recordReview(workspace, projectId, artifactId, {
      decision: 'accept', notes: 'first', reviewer: 'auditor', authority: 'auditor', template: 'evidence',
    })
    // Rewrite the file in the pre-fix shape: top-level record only, no `history`.
    const full = JSON.parse(await readFile(reviewFile, 'utf8'))
    const legacy = {
      artifactId: full.artifactId,
      title: full.title,
      decision: full.decision,
      notes: full.notes,
      reviewer: full.reviewer,
      authority: full.authority,
      template: full.template,
      signature: full.signature,
      artifactChecksum: full.artifactChecksum,
      createdAt: full.createdAt,
      round: 1,
    }
    await writeFile(reviewFile, `${JSON.stringify(legacy, null, 2)}\n`, 'utf8')

    const legacyVerified = await verifyReview(workspace, projectId, artifactId)
    assert.equal(legacyVerified.roundCount, 1)
    assert.equal(legacyVerified.rounds[0].status, 'valid', 'a legacy signature must still verify')
    assert.equal(legacyVerified.valid, true)

    // Appending must carry the legacy fields forward instead of rebuilding an unsigned stub.
    await recordReview(workspace, projectId, artifactId, { decision: 'revise', notes: 'second', reviewer: 'auditor' })
    const appended = JSON.parse(await readFile(reviewFile, 'utf8'))
    assert.equal(appended.history.length, 2)
    assert.equal(appended.history[0].authority, 'auditor')
    assert.equal(appended.history[0].template, 'evidence')
    assert.equal(appended.history[0].signature, legacy.signature)

    const afterAppend = await verifyReview(workspace, projectId, artifactId)
    assert.deepEqual(afterAppend.rounds.map((round) => round.status), ['valid', 'valid'])
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('a round without a signature is reported unverifiable, never valid', async () => {
  const { workspace, projectId, artifactId, reviewFile } = await setup()
  try {
    await recordReview(workspace, projectId, artifactId, { decision: 'accept', notes: 'x', reviewer: 'auditor' })
    const stored = JSON.parse(await readFile(reviewFile, 'utf8'))
    delete stored.history[0].signature
    delete stored.signature
    await writeFile(reviewFile, `${JSON.stringify(stored, null, 2)}\n`, 'utf8')

    const verified = await verifyReview(workspace, projectId, artifactId)
    assert.equal(verified.rounds[0].status, 'unverifiable-legacy')
    assert.equal(verified.valid, false)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('provenance derives the review face without rewriting the artifact sidecar', async () => {
  const { workspace, projectId, artifactId, sidecarFile } = await setup()
  try {
    const before = await getProvenance(workspace, projectId, artifactId)
    assert.equal(before.faces.review.status, 'unavailable')
    assert.equal(before.reviewSource, 'artifact-sidecar-snapshot')
    assert.equal(Object.keys(before.faces).length, 7)
    const sidecarDigest = sha256(await readFile(sidecarFile))

    await recordReview(workspace, projectId, artifactId, { decision: 'accept', notes: 'derived', reviewer: 'auditor', authority: 'auditor' })

    const after = await getProvenance(workspace, projectId, artifactId)
    assert.equal(Object.keys(after.faces).length, 7, 'the seven-face contract is unchanged')
    assert.equal(after.faces.review.status, 'available')
    assert.equal(after.faces.review.decision, 'accept')
    assert.equal(after.faces.review.round, 1)
    assert.equal(after.reviewSource, 'derived-from-reviews')
    assert.equal(after.reviewSnapshot.status, 'unavailable', 'the recorded snapshot stays visible')
    assert.equal(sha256(await readFile(sidecarFile)), sidecarDigest, 'the immutable artifact must not be rewritten')
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('import refuses a payload that no longer matches the manifest', async () => {
  const { workspace, projectId, artifactId } = await setup()
  try {
    await recordReview(workspace, projectId, artifactId, { decision: 'accept', notes: 'x', reviewer: 'auditor' })
    const exported = await exportScience(workspace, projectId, { name: 'sig' })
    const archivePath = join(workspace, exported.path)
    const entries = parseTar(gunzipSync(await readFile(archivePath)))
    const rebuilt = entries.map((entry) => ({
      name: entry.name,
      data: entry.name === `payload/reviews/${artifactId}.json`
        ? Buffer.from('{"artifactId":"tampered"}\n', 'utf8')
        : entry.data,
    }))
    await writeFile(archivePath, gzipSync(buildTar(rebuilt)))

    await assert.rejects(
      () => importScience(workspace, exported.path, { name: 'sig' }),
      /failed checksum verification/,
    )
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('import refuses an archive missing a declared file', async () => {
  const { workspace, projectId, artifactId } = await setup()
  try {
    await recordReview(workspace, projectId, artifactId, { decision: 'accept', notes: 'x', reviewer: 'auditor' })
    const exported = await exportScience(workspace, projectId, { name: 'sig2' })
    const archivePath = join(workspace, exported.path)
    const kept = parseTar(gunzipSync(await readFile(archivePath)))
      .filter((entry) => entry.name !== `payload/reviews/${artifactId}.json`)
      .map((entry) => ({ name: entry.name, data: entry.data }))
    await writeFile(archivePath, gzipSync(buildTar(kept)))

    await assert.rejects(
      () => importScience(workspace, exported.path, { name: 'sig2' }),
      /missing declared files/,
    )
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

// --- regressions found by the independent QA pass ---

test('import refuses an undeclared payload file', async () => {
  const { workspace, projectId, artifactId } = await setup()
  try {
    await recordReview(workspace, projectId, artifactId, { decision: 'accept', notes: 'x', reviewer: 'auditor' })
    const exported = await exportScience(workspace, projectId, { name: 'extra' })
    const archivePath = join(workspace, exported.path)
    const entries = parseTar(gunzipSync(await readFile(archivePath)))
    const smuggled = [...entries.map((entry) => ({ name: entry.name, data: entry.data })), {
      name: 'payload/reviews/injected.json',
      data: Buffer.from('{"decision":"accept"}\n', 'utf8'),
    }]
    await writeFile(archivePath, gzipSync(buildTar(smuggled)))

    await assert.rejects(
      () => importScience(workspace, exported.path, { name: 'extra' }),
      /undeclared payload files/,
    )
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('a malformed round is reported, not thrown', async () => {
  const { workspace, projectId, artifactId, reviewFile } = await setup()
  try {
    await recordReview(workspace, projectId, artifactId, { decision: 'accept', notes: 'x', reviewer: 'auditor' })
    const stored = JSON.parse(await readFile(reviewFile, 'utf8'))
    const good = stored.history[0]
    await writeFile(reviewFile, `${JSON.stringify({ ...stored, history: [null, good] }, null, 2)}\n`, 'utf8')

    const verified = await verifyReview(workspace, projectId, artifactId)
    assert.equal(verified.roundCount, 2)
    assert.equal(verified.rounds[0].status, 'invalid')
    assert.equal(verified.rounds[0].reason, 'round entry is not an object')
    assert.equal(verified.rounds[1].status, 'valid')
    assert.equal(verified.valid, false)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('a traversal entry is refused before anything is written', async () => {
  const { workspace, projectId, artifactId } = await setup()
  try {
    await recordReview(workspace, projectId, artifactId, { decision: 'accept', notes: 'x', reviewer: 'auditor' })
    const exported = await exportScience(workspace, projectId, { name: 'trav' })
    const archivePath = join(workspace, exported.path)
    const entries = parseTar(gunzipSync(await readFile(archivePath)))
    const hostile = [...entries.map((entry) => ({ name: entry.name, data: entry.data })), {
      name: 'payload/..\\..\\evil-two.txt',
      data: Buffer.from('escape\n', 'utf8'),
    }]
    await writeFile(archivePath, gzipSync(buildTar(hostile)))

    await assert.rejects(
      () => importScience(workspace, exported.path, { name: 'trav' }),
      /escapes the import target/,
    )
    // Nothing may be left behind: validation happens before the first mkdir.
    await assert.rejects(() => access(join(workspace, '.research', 'imports')), /ENOENT/)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('a missing review reports unknown review, not a raw ENOENT', async () => {
  const { workspace, projectId } = await setup()
  try {
    await assert.rejects(
      () => verifyReview(workspace, projectId, 'a'.repeat(64)),
      /unknown review/,
    )
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

// --- D1-3: import failure cleanup and source immutability ---

test('a write failure mid-import removes the half-written import and leaves the source untouched', async () => {
  const { workspace, projectId, artifactId, sidecarFile, reviewFile } = await setup()
  try {
    await recordReview(workspace, projectId, artifactId, { decision: 'accept', notes: 'x', reviewer: 'auditor' })
    const exported = await exportScience(workspace, projectId, { name: 'iofail' })

    const sidecarBefore = sha256(await readFile(sidecarFile))
    const reviewBefore = sha256(await readFile(reviewFile))

    // Delegate to the real node IO, but fail on the second payload write.
    const { createNodeIO } = await import('../lib/io.js')
    const realIO = createNodeIO()
    let payloadWrites = 0
    const failingIO = {
      ...realIO,
      async writeBytes(path, bytes) {
        if (String(path).includes('payload')) {
          payloadWrites += 1
          if (payloadWrites === 2) throw new Error('simulated disk failure')
        }
        return realIO.writeBytes(path, bytes)
      },
    }

    await assert.rejects(
      () => importScience(workspace, exported.path, { name: 'iofail' }, failingIO),
      /simulated disk failure/,
    )

    assert.ok(payloadWrites >= 2, 'the failure must happen after at least one payload write')
    // No half-written import may survive the failure. The empty `imports/` container
    // is allowed; what must not exist is any `imports/<id>` directory.
    let leftovers = []
    try {
      leftovers = (await readdir(join(workspace, '.research', 'imports'), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    assert.deepEqual(leftovers, [], 'no partial import directory may be left behind')

    // The source project stays byte-identical: importing must never mutate it.
    assert.equal(sha256(await readFile(sidecarFile)), sidecarBefore, 'artifact sidecar must be untouched')
    assert.equal(sha256(await readFile(reviewFile)), reviewBefore, 'review record must be untouched')
    const provenance = await getProvenance(workspace, projectId, artifactId)
    assert.equal(provenance.reviewSource, 'derived-from-reviews')
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

// --- D2 regressions found by the evidence lane ---

test('a structurally corrupt history is reported, not passed as legacy', async () => {
  const { workspace, projectId, artifactId, reviewFile } = await setup()
  try {
    await recordReview(workspace, projectId, artifactId, { decision: 'accept', notes: 'x', reviewer: 'auditor' })
    const stored = JSON.parse(await readFile(reviewFile, 'utf8'))

    // A non-array history used to fall through to the legacy branch and report valid.
    await writeFile(reviewFile, `${JSON.stringify({ ...stored, history: 'not-an-array' }, null, 2)}\n`, 'utf8')
    const asString = await verifyReview(workspace, projectId, artifactId)
    assert.equal(asString.valid, false, 'a corrupt history must never verify as valid')
    assert.equal(asString.rounds[0].status, 'invalid')
    assert.equal(asString.rounds[0].reason, 'history is not an array')

    // An empty array is a history claim too, not a legacy record.
    await writeFile(reviewFile, `${JSON.stringify({ ...stored, history: [] }, null, 2)}\n`, 'utf8')
    const asEmpty = await verifyReview(workspace, projectId, artifactId)
    assert.equal(asEmpty.valid, false)
    assert.equal(asEmpty.rounds[0].reason, 'history array is empty')

    // No history key at all stays a legacy single record and still verifies.
    const legacyShape = { ...stored }
    delete legacyShape.history
    await writeFile(reviewFile, `${JSON.stringify(legacyShape, null, 2)}\n`, 'utf8')
    const legacy = await verifyReview(workspace, projectId, artifactId)
    assert.equal(legacy.roundCount, 1)
    assert.equal(legacy.rounds[0].status, 'valid')
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('a directory created just before a failure is still cleaned up', async () => {
  const { workspace, projectId, artifactId } = await setup()
  try {
    await recordReview(workspace, projectId, artifactId, { decision: 'accept', notes: 'x', reviewer: 'auditor' })
    const exported = await exportScience(workspace, projectId, { name: 'mkdirfail' })

    const { createNodeIO } = await import('../lib/io.js')
    const realIO = createNodeIO()
    // mkdir creates the directory and THEN fails: cleanup must still run.
    const failingIO = {
      ...realIO,
      async mkdir(path) {
        await realIO.mkdir(path)
        if (String(path).endsWith('payload')) throw new Error('simulated mkdir failure after creation')
      },
    }

    await assert.rejects(
      () => importScience(workspace, exported.path, { name: 'mkdirfail' }, failingIO),
      /simulated mkdir failure/,
    )

    let leftovers = []
    try {
      leftovers = (await readdir(join(workspace, '.research', 'imports'), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    assert.deepEqual(leftovers, [], 'a directory made before the failure must not survive')
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('the read-only claim on an import matches what the filesystem actually allows', async () => {
  const { workspace, projectId, artifactId } = await setup()
  try {
    await recordReview(workspace, projectId, artifactId, { decision: 'accept', notes: 'x', reviewer: 'auditor' })
    const exported = await exportScience(workspace, projectId, { name: 'ro' })
    const imported = await importScience(workspace, exported.path, { name: 'ro' })

    assert.equal(imported.readOnly, true, 'the intent is still declared')
    assert.equal(typeof imported.readOnlyEnforced, 'boolean', 'enforcement must be reported, not assumed')
    assert.ok(imported.readOnlyNote.length > 0)

    // Measure it ourselves: if we can still write inside the payload, enforcement is false.
    const probe = join(workspace, imported.path, 'payload', '.test-probe')
    let writable = false
    try {
      await writeFile(probe, 'probe', 'utf8')
      writable = true
      await rm(probe, { force: true })
    } catch {
      writable = false
    }
    assert.equal(
      imported.readOnlyEnforced,
      !writable,
      `readOnlyEnforced=${imported.readOnlyEnforced} but writable=${writable}: the flag must not overstate enforcement`,
    )
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('an unparsable review file fails as a ScienceError, not a raw SyntaxError', async () => {
  const { workspace, projectId, artifactId, reviewFile } = await setup()
  try {
    await recordReview(workspace, projectId, artifactId, { decision: 'accept', notes: 'x', reviewer: 'auditor' })
    await writeFile(reviewFile, '{ this is not json ', 'utf8')

    await assert.rejects(
      () => verifyReview(workspace, projectId, artifactId),
      (error) => {
        assert.equal(error.name, 'ScienceError', `expected ScienceError, got ${error.name}`)
        assert.match(error.message, /not parsable JSON/)
        return true
      },
    )
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})
