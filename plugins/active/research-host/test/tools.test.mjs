import assert from 'node:assert/strict'
import test from 'node:test'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { apply } from '../index.js'

test('host registers ten tools and strips a project cwd back to the workspace root', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'research-core-'))
  const projectCwd = join(workspace, '.research', 'projects', 'phase1')
  const registered = []
  const ctx = {
    get(name) {
      if (name === 'workingDirectory') return { ensure: async () => projectCwd }
      return undefined
    },
    effect(fn) { return fn() },
    tools: { register(definition) { registered.push(definition); return () => {} } },
    logger: { warn() {} },
  }
  try {
    apply(ctx)
    assert.equal(registered.length, 10)
    const byName = Object.fromEntries(registered.map((tool) => [tool.name, tool]))
    const exec = { agent: {}, signal: AbortSignal.timeout(10_000) }

    const created = JSON.parse(await byName.research_project_create.execute({ name: '测试项目', template: 'data-analysis' }, exec))
    assert.equal(created.project.template, 'data-analysis')
    const projectId = created.project.id

    const recorded = JSON.parse(await byName.research_artifact_record.execute({
      projectId,
      title: '分析日志',
      content: 'n=42\n',
      code: 'node analysis.mjs',
    }, exec))
    assert.equal(recorded.created, true)
    assert.match(recorded.path, /^\.research[\\/]projects[\\/]/)
    await access(join(projectCwd, '.research')).then(
      () => assert.fail('nested .research must not be created under the project cwd'),
      () => {},
    )

    const listed = JSON.parse(await byName.research_artifact_list.execute({ projectId }, exec))
    assert.equal(listed.artifacts.length, 1)

    const provenance = JSON.parse(await byName.research_provenance_get.execute({ projectId, artifactId: recorded.artifact.id }, exec))
    assert.equal(Object.keys(provenance.faces).length, 7)

    const review = JSON.parse(await byName.research_review_record.execute({
      projectId, artifactId: recorded.artifact.id, decision: 'accept', notes: 'checked', reviewer: 'auditor', template: 'evidence', authority: 'auditor',
    }, exec))
    assert.equal(review.review.decision, 'accept')
    assert.equal(review.review.template, 'evidence')
    assert.equal(review.review.authority, 'auditor')
    assert.match(review.review.signature, /^[0-9a-f]{64}$/)
    const verified = JSON.parse(await byName.research_review_verify.execute({ projectId, artifactId: recorded.artifact.id }, exec))
    assert.equal(verified.valid, true)
    const review2 = JSON.parse(await byName.research_review_record.execute({
      projectId, artifactId: recorded.artifact.id, decision: 'revise', notes: 'second round', reviewer: 'auditor',
    }, exec))
    assert.equal(review2.review.decision, 'revise')
    assert.equal(review2.review.round, 2)
    assert.equal(review2.review.history.length, 2)
    const reviews = JSON.parse(await byName.research_review_list.execute({ projectId }, exec))
    assert.equal(reviews.reviews.length, 1)
    assert.equal(reviews.reviews[0].round, 2)

    const exported = JSON.parse(await byName.research_science_export.execute({ projectId, name: 'bundle' }, exec))
    assert.match(exported.path, /\.science$/)
    const imported = JSON.parse(await byName.research_science_import.execute({ archive: exported.path, name: 'bundle' }, exec))
    assert.equal(imported.readOnly, true)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})



