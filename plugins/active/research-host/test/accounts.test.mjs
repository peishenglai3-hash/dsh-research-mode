// Accounting is optional, reported, and never inferred. The load-bearing rule is the negative one:
// an artifact with no rights statement must NOT read as if it were free to redistribute.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { createProject, getProvenance, recordArtifact } from '../lib/store.js'

async function setup() {
  const workspace = await mkdtemp(join(tmpdir(), 'research-accounts-'))
  const { project } = await createProject(workspace, { name: 'accounts' })
  return { workspace, projectId: project.id }
}

test('an artifact with no accounting says so, and does not default to free', async () => {
  const { workspace, projectId } = await setup()
  try {
    const recorded = await recordArtifact(workspace, projectId, { title: 'draft.md', content: '# draft\n' })
    const provenance = await getProvenance(workspace, projectId, recorded.artifact.id)
    assert.equal(provenance.accounts.status, 'unavailable')
    assert.match(provenance.accounts.reason, /absence is not permission/)
    assert.equal(JSON.stringify(provenance.accounts).includes('"free"'), false)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('a partial accounting block reports the missing fields instead of filling them in', async () => {
  const { workspace, projectId } = await setup()
  try {
    const recorded = await recordArtifact(workspace, projectId, {
      title: 'table.csv', content: 'a,b\n1,2\n', rights: 'CC-BY-4.0 (reported)',
    })
    const provenance = await getProvenance(workspace, projectId, recorded.artifact.id)
    assert.equal(provenance.accounts.status, 'partial')
    assert.equal(provenance.accounts.rights.value, 'CC-BY-4.0 (reported)')
    assert.equal(provenance.accounts.rights.mode, 'reported')
    assert.equal(provenance.accounts.producedBy.status, 'unavailable')
    assert.equal(provenance.accounts.contributors.status, 'unavailable')
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('a complete accounting block is echoed verbatim and marked reported', async () => {
  const { workspace, projectId } = await setup()
  try {
    const recorded = await recordArtifact(workspace, projectId, {
      title: 'note.md',
      content: '# note\n',
      rights: 'internal-only (reported)',
      producedBy: 'deepseek-flash (drafting), human (review)',
      contributors: 'Lai Peisheng (author)',
    })
    const provenance = await getProvenance(workspace, projectId, recorded.artifact.id)
    assert.equal(provenance.accounts.status, 'available')
    assert.equal(provenance.accounts.producedBy.value, 'deepseek-flash (drafting), human (review)')
    assert.equal(provenance.accounts.contributors.value, 'Lai Peisheng (author)')
    assert.match(provenance.accounts.note, /not verified/)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})
