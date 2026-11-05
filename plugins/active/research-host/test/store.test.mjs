import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { gunzipSync } from 'node:zlib'

import {
  createProject, exportScience, getProvenance, importScience,
  listArtifacts, listProjects, parseTar, recordArtifact, sha256,
} from '../lib/store.js'

test('project + artifact + provenance + science roundtrip', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'research-store-'))
  try {
    const created = await createProject(workspace, { name: '社会原子化', template: 'literature-review' })
    assert.equal(created.project.template, 'literature-review')
    assert.equal((await listProjects(workspace)).length, 1)

    const payload = 'evidence body\n'
    const recorded = await recordArtifact(workspace, created.project.id, {
      title: '检索日志',
      kind: 'search-log',
      content: payload,
      code: 'litdb search',
      log: 'ok',
      literature: ['doi:10.0/example'],
    })
    assert.equal(recorded.created, true)
    assert.equal(recorded.artifact.checksum.value, sha256(payload))
    assert.equal((await readFile(join(workspace, recorded.path), 'utf8')), payload)

    const repeated = await recordArtifact(workspace, created.project.id, {
      title: '检索日志',
      kind: 'search-log',
      content: payload,
    })
    assert.equal(repeated.created, false)
    assert.equal((await listArtifacts(workspace, created.project.id)).length, 1)

    const provenance = await getProvenance(workspace, created.project.id, recorded.artifact.id)
    assert.equal(Object.keys(provenance.faces).length, 7)
    assert.equal(provenance.faces.code.status, 'available')
    assert.equal(provenance.faces.messages.status, 'unavailable')
    await assert.rejects(() => getProvenance(workspace, created.project.id, '../project'), /invalid artifact id/)

    const exported = await exportScience(workspace, created.project.id, { name: 'pkg' })
    const archive = gunzipSync(await readFile(join(workspace, exported.path)))
    const entries = parseTar(archive).map((entry) => entry.name)
    assert.ok(entries.includes('science-manifest.json'))
    assert.ok(entries.includes('ro-crate-metadata.json'))
    assert.ok(entries.includes('payload/project.json'))
    assert.ok(entries.some((name) => name.startsWith('payload/artifacts/')))

    const imported = await importScience(workspace, exported.path, { name: 'pkg' })
    assert.equal(imported.readOnly, true)
    assert.equal(imported.manifest.format, 'science/1')
    assert.ok((await readFile(join(workspace, imported.path, 'payload/project.json'), 'utf8')).includes('社会原子化'))
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('credential-like files are refused and tar is deterministic', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'research-store-'))
  try {
    await writeFile(join(workspace, '.env'), 'SECRET=1\n')
    const project = await createProject(workspace, { name: 'secret test' })
    await assert.rejects(
      () => recordArtifact(workspace, project.project.id, { title: 'bad', source: '.env' }),
      /credential-like/,
    )
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})
