import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { apply } from '../index.js'
import { inspectNotebook } from '../lib/inspect.js'

function notebook() {
  return {
    nbformat: 4,
    nbformat_minor: 5,
    cells: [
      { cell_type: 'markdown', source: ['# Analysis'] },
      { cell_type: 'code', execution_count: 1, source: ['import pandas as pd\nimport numpy as np'], outputs: [{ output_type: 'stream', text: 'ok' }] },
      { cell_type: 'code', execution_count: null, source: ['df = pd.read_csv("data.csv")'], outputs: [] },
      { cell_type: 'code', execution_count: 2, source: ['from pathlib import Path'], outputs: [] },
    ],
  }
}

test('notebook inspection is read-only and reports cells/imports/gaps', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'research-nb-'))
  const project = join(workspace, '.research', 'projects', 'p1')
  await mkdir(project, { recursive: true })
  const file = join(project, 'analysis.ipynb')
  await writeFile(file, JSON.stringify(notebook()), 'utf8')
  try {
    const result = await inspectNotebook(workspace, 'p1', 'analysis.ipynb')
    assert.equal(result.cellCount, 4)
    assert.equal(result.codeCellCount, 3)
    assert.equal(result.executableCount, 2)
    assert.deepEqual(result.imports, ['pandas', 'numpy', 'pathlib'])
    assert.match(result.reviewBoundary, /no cell execution/)
    assert.ok(result.gaps.length >= 2)
    await assert.rejects(() => inspectNotebook(workspace, 'p1', '../outside.ipynb'), /outside the project|ENOENT/)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('notebook tool registers one read-only inspection', async () => {
  const registered = []
  apply({ effect(fn) { return fn() }, get() { return undefined }, tools: { register(tool) { registered.push(tool) } } })
  assert.deepEqual(registered.map((tool) => tool.name), ['research_notebook_inspect'])
  assert.equal(registered[0].isConcurrencySafe(), true)
})
