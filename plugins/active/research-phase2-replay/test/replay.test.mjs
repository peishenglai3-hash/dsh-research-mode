import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { replayPlan } from '../lib/plan.js'

test('replay plan inventories artifacts/reviews/exports and reports gaps', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'research-replay-'))
  const project = join(workspace, '.research', 'projects', 'p1')
  await mkdir(join(project, 'artifacts'), { recursive: true })
  await mkdir(join(project, 'reviews'), { recursive: true })
  await mkdir(join(project, 'exports'), { recursive: true })
  await writeFile(join(project, 'project.json'), JSON.stringify({ id: 'p1', name: 'P', template: 'data-analysis' }))
  await writeFile(join(project, 'artifacts', 'a.json'), JSON.stringify({
    id: 'a'.repeat(64), title: 'A', checksum: { algorithm: 'sha256', value: 'a'.repeat(64) },
    provenance: { code: { status: 'available', value: 'python x.py' }, execution: { status: 'available', value: 'ok' }, environment: { status: 'available', value: 'py3.12' } },
  }))
  await writeFile(join(project, 'reviews', 'a.json'), JSON.stringify({ artifactId: 'a'.repeat(64), decision: 'accept' }))
  await writeFile(join(project, 'exports', 'p.science'), 'x')
  try {
    const result = await replayPlan(workspace, 'p1')
    assert.equal(result.artifactCount, 1)
    assert.equal(result.reviewCount, 1)
    assert.deepEqual(result.exports, ['p.science'])
    assert.equal(result.steps[0].review, 'accept')
    assert.deepEqual(result.gaps, [])
    assert.match(result.replayBoundary, /no command is executed/)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})
