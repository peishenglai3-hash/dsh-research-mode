import assert from 'node:assert/strict'
import test from 'node:test'

import { apply } from '../index.js'

test('apply registers six tools with raw JSON Schema and string output', () => {
  const registered = []
  const ctx = {
    effect(fn) { return fn() },
    tools: {
      register(definition) {
        registered.push(definition)
        return () => {}
      },
    },
    logger: { warn() {} },
  }
  apply(ctx)
  assert.equal(registered.length, 8)
  assert.deepEqual(
    registered.map((tool) => tool.name).sort(),
    [
      'research_crossref_search',
      'research_datacite_search',
      'research_ilostat_data',
      'research_nbs_snapshot',
      'research_openalex_search',
      'research_pku_dataverse_search',
      'research_socarxiv_search',
      'research_worldbank_indicator',
    ],
  )
  for (const tool of registered) {
    assert.equal(tool.parameters.type, 'object')
    assert.ok(Array.isArray(tool.parameters.required))
    assert.equal(tool.output.schema.type, 'string')
    assert.equal(typeof tool.execute, 'function')
    assert.equal(tool.isConcurrencySafe(), true)
  }
})
