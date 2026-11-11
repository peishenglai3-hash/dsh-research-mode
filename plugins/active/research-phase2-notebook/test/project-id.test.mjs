import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { inspectNotebook } from '../lib/inspect.js'
import { replayPlan } from '../../research-phase2-replay/lib/plan.js'

// A projectId is a directory name, not a path. The previous guard was
// /^[\p{Letter}\p{Number}._-]+$/u, which admits "." and ".." because a dot is a
// legal character in a directory name. With projectId "..", the project root
// resolves to <workspace>/.research, and a notebookPath relative to that root
// can read a *sibling project's* notebook. These tests pin that shut.

function notebook(marker) {
  return {
    nbformat: 4,
    nbformat_minor: 5,
    cells: [{ cell_type: 'code', execution_count: 1, source: [marker], outputs: [] }],
  }
}

async function fixture() {
  const workspace = await mkdtemp(join(tmpdir(), 'research-nb-id-'))
  const victim = join(workspace, '.research', 'projects', 'victim')
  const attacker = join(workspace, '.research', 'projects', 'attacker')
  await mkdir(victim, { recursive: true })
  await mkdir(attacker, { recursive: true })
  await writeFile(join(victim, 'analysis.ipynb'), JSON.stringify(notebook('VICTIM_SECRET_CELL')), 'utf8')
  return { workspace, victim }
}

test('projectId "." and ".." are refused', async () => {
  const { workspace } = await fixture()
  try {
    for (const id of ['.', '..', '../victim', 'a/b', 'a\\b', '']) {
      await assert.rejects(
        () => inspectNotebook(workspace, id, 'analysis.ipynb'),
        /invalid projectId/,
        `projectId ${JSON.stringify(id)} must be refused as invalid, not resolved as a path`,
      )
    }
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('a traversal projectId cannot read a sibling project notebook', async () => {
  const { workspace } = await fixture()
  try {
    // The pre-fix exploit: projectId ".." roots at <workspace>/.research, so this
    // path lands in the victim project and returns its cells.
    let leaked = false
    try {
      const result = await inspectNotebook(workspace, '..', 'projects/victim/analysis.ipynb')
      leaked = JSON.stringify(result).includes('VICTIM_SECRET_CELL')
    } catch (error) {
      assert.match(String(error.message), /invalid projectId/)
    }
    assert.equal(leaked, false, 'a sibling project notebook must not be readable through projectId ".."')
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('replayPlan refuses path-like projectIds instead of resolving them', async () => {
  const { workspace } = await fixture()
  try {
    for (const id of ['.', '..', '../victim', 'a/b']) {
      await assert.rejects(() => replayPlan(workspace, id), /invalid projectId/)
    }
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('a normal projectId still works (no over-blocking)', async () => {
  const { workspace } = await fixture()
  try {
    const result = await inspectNotebook(workspace, 'victim', 'analysis.ipynb')
    assert.equal(result.cellCount, 1)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('a junction planted at a project directory cannot escape the workspace', async (t) => {
  // Independent QA reproduced this: realpath(project) follows the junction, and the old check
  // only compared the notebook against that root — so containment was anchored at a directory
  // the attacker chose. The guard must anchor at <workspace>/.research/projects.
  const workspace = await mkdtemp(join(tmpdir(), 'research-nb-junction-'))
  const outside = await mkdtemp(join(tmpdir(), 'research-nb-outside-'))
  try {
    await mkdir(join(workspace, '.research', 'projects'), { recursive: true })
    await writeFile(join(outside, 'SECRET.ipynb'), JSON.stringify(notebook('OUTSIDE_SECRET')), 'utf8')
    try {
      await symlink(outside, join(workspace, '.research', 'projects', 'p2'), 'junction')
    } catch (error) {
      t.skip(`junction not creatable here: ${error?.code ?? error?.message}`)
      return
    }
    let leaked = false
    try {
      const result = await inspectNotebook(workspace, 'p2', 'SECRET.ipynb')
      leaked = JSON.stringify(result).includes('OUTSIDE_SECRET')
    } catch (error) {
      assert.match(String(error.message), /outside the workspace research root/)
    }
    assert.equal(leaked, false, 'a junction must not move the containment anchor outside the workspace')
  } finally {
    await rm(workspace, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})

test('a non-canonical projectId is refused rather than resolving to another casing', async () => {
  const { workspace } = await fixture()
  try {
    // On a case-sensitive filesystem this is ENOENT; on Windows it would resolve to "victim",
    // giving one project two identities. Either way it must not succeed.
    await assert.rejects(
      () => inspectNotebook(workspace, 'VICTIM', 'analysis.ipynb'),
      /non-canonical projectId|ENOENT/,
    )
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

