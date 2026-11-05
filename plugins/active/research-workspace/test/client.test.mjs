import assert from 'node:assert/strict'
import test from 'node:test'

let definition
globalThis.window = {
  __ModuleLoader__: {
    load(value) { definition = value },
  },
}
await import(new URL('../client.js', import.meta.url).href)

const React = {
  createElement(type, props, ...children) { return { type, props, children } },
}

test('client registers one sidebar entry and one main panel keyed research', () => {
  const registrations = []
  const injections = []
  const plugin = definition.factory((id) => {
    assert.equal(id, 'react')
    return React
  })
  const ctx = {
    locale: {
      register() { return () => {} },
      bind() { return (key) => ({ entry: '科研', title: '科研工作台' }[key] ?? key) },
    },
    effect(fn) { return fn() },
    layout: { selectPanel() {} },
    slots: {
      inject(name, fn) { injections.push(name); return fn() },
      register(options) { registrations.push(options); return () => {} },
    },
  }
  plugin.apply(ctx)
  assert.deepEqual(injections, ['sidebar.panellist', 'main'])
  const sidebar = registrations.find((entry) => entry.name === 'sidebar.panellist')
  const main = registrations.find((entry) => entry.name === 'main')
  assert.equal(sidebar.id, 'research')
  assert.equal(sidebar.order, 30)
  assert.equal(typeof sidebar.label, 'function')
  assert.equal(main.key, 'research')
})

test('workspace resolver uses an explicit workspace root and never guesses another cwd', () => {
  const plugin = definition.factory(() => React)
  const { chooseWorkspaceSession } = plugin._internals
  const sessions = [
    { id: 'other', cwd: 'C:\\Other' },
    { id: 'nested', cwd: 'C:\\Workspace\\project' },
    { id: 'root', cwd: 'C:\\Workspace' },
  ]
  assert.equal(chooseWorkspaceSession('C:\\Workspace', sessions)?.id, 'root')
  assert.equal(chooseWorkspaceSession('C:\\Workspace', [sessions[0]]), null)
  assert.equal(chooseWorkspaceSession(null, sessions), null)
})
