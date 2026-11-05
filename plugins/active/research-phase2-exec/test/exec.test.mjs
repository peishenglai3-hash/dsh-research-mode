import assert from 'node:assert/strict'
import test from 'node:test'
import { runConfined } from '../lib/run.js'

test('runConfined executes a confined argv and captures output', async () => {
  const result = await runConfined({
    async confine(argv) { return { argv, enforcement: { mode: 'workspace-write' } } },
  }, [process.execPath, '-e', 'process.stdout.write("sandbox-ok")'], { timeoutMs: 5000 })
  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout, 'sandbox-ok')
  assert.equal(result.enforcedBy, 'dsh-sandbox')
  assert.equal(result.networkIsolated, false)
})

test('tool registration includes notebook and replay execution', async () => {
  const { apply } = await import('../index.js')
  const registered = []
  apply({ effect(fn) { return fn() }, tools: { register(tool) { registered.push(tool.name) } } })
  assert.deepEqual(registered.sort(), ['research_notebook_execute', 'research_replay_execute'])
})
