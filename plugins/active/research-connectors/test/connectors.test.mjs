import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  dataCiteSearch,
  ilostatData,
  nbsSnapshot,
  openAlexSearch,
  pkuDataverseSearch,
  socArxivSearch,
  worldBankIndicator,
  crossrefSearch,
} from '../lib/connectors.js'

function jsonResponse(value) {
  return {
    ok: true,
    status: 200,
    async json() { return value },
    async text() { return JSON.stringify(value) },
  }
}

function textResponse(value) {
  return {
    ok: true,
    status: 200,
    async json() { throw new Error('not json') },
    async text() { return value },
  }
}

test('worldBankIndicator builds the official URL and normalizes rows', async () => {
  let seen
  const result = await worldBankIndicator(
    { country: 'CHN', indicator: 'SI.POV.GINI', date: '2020:2024' },
    {
      fetchImpl: async (url) => {
        seen = String(url)
        return jsonResponse([
          { page: 1 },
          [{
            country: { value: 'China' },
            countryiso3code: 'CHN',
            date: '2022',
            value: 37.1,
            indicator: { value: 'Gini index' },
          }],
        ])
      },
    },
  )
  assert.match(seen, /api\.worldbank\.org\/v2\/country\/CHN\/indicator\/SI\.POV\.GINI/)
  assert.match(seen, /format=json/)
  assert.match(seen, /date=2020%3A2024|date=2020:2024/)
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].value, 37.1)
  assert.equal(result.rows[0].country, 'China')
})

test('dataCiteSearch normalizes DOI records', async () => {
  let seen
  const result = await dataCiteSearch(
    { query: 'social inequality', pageSize: 5 },
    {
      fetchImpl: async (url) => {
        seen = String(url)
        return jsonResponse({
          data: [{
            id: '10.1234/example',
            attributes: {
              doi: '10.1234/example',
              titles: [{ title: 'A dataset' }],
              publisher: 'Example',
              publicationYear: 2024,
              url: 'https://example.org/data',
              types: { resourceTypeGeneral: 'Dataset' },
            },
          }],
        })
      },
    },
  )
  assert.match(seen, /api\.datacite\.org\/dois/)
  assert.match(seen, /query=social(?:\+|%20)inequality/)
  assert.equal(result.rows[0].doi, '10.1234/example')
  assert.equal(result.rows[0].title, 'A dataset')
})

test('ilostatData requests SDMX CSV and returns the payload', async () => {
  let seen
  const result = await ilostatData(
    { dataflow: 'DF_TEST', version: '1.0', key: 'A.CHN', startPeriod: '2020', endPeriod: '2024' },
    {
      fetchImpl: async (url) => {
        seen = String(url)
        return textResponse('TIME_PERIOD,OBS_VALUE\n2020,5.2\n')
      },
    },
  )
  assert.match(seen, /sdmx\.ilo\.org\/rest\/data\/ILO,DF_TEST,1\.0\/A\.CHN/)
  assert.match(seen, /format=csv/)
  assert.match(seen, /startPeriod=2020/)
  assert.match(result.csv, /2020,5\.2/)
})

test('socArxivSearch falls back to list-filter for a multi-word zero-hit title filter', async () => {
  const calls = []
  const result = await socArxivSearch(
    { query: 'social atomization', pageSize: 5 },
    {
      fetchImpl: async (url) => {
        calls.push(String(url))
        if (calls.length === 1) return jsonResponse({ data: [] })
        return jsonResponse({
          data: [{
            id: 'fallback1',
            attributes: {
              title: 'Social atomization and inequality',
              date_published: '2024-02-03',
              description: 'A paper about social atomization.',
            },
            links: { html: 'https://osf.io/preprints/socarxiv/fallback1/' },
          }],
        })
      },
    },
  )
  assert.equal(calls.length, 2)
  assert.match(result.backend, /^list-filter/)
  assert.equal(result.rows[0].id, 'fallback1')
})

test('socArxivSearch normalizes OSF preprint records', async () => {
  let seen
  const result = await socArxivSearch(
    { query: 'social atomization', pageSize: 5 },
    {
      fetchImpl: async (url) => {
        seen = String(url)
        return jsonResponse({
          data: [{
            id: 'abc12',
            attributes: {
              title: 'Social atomization',
              date_published: '2024-01-02',
              description: 'A preprint',
            },
            links: { html: 'https://osf.io/preprints/socarxiv/abc12/' },
          }],
        })
      },
    },
  )
  assert.match(seen, /api\.osf\.io\/v2\/preprints/)
  assert.match(seen, /socarxiv/)
  assert.equal(result.rows[0].id, 'abc12')
  assert.equal(result.rows[0].title, 'Social atomization')
})

test('pkuDataverseSearch normalizes Dataverse items', async () => {
  let seen
  const result = await pkuDataverseSearch(
    { query: 'CFPS', pageSize: 5 },
    {
      fetchImpl: async (url) => {
        seen = String(url)
        return jsonResponse({
          data: {
            items: [{
              name: 'China Family Panel Studies',
              doi: 'doi:10.18170/DVN/45LCSO',
              url: 'https://opendata.pku.edu.cn/dataset.xhtml?persistentId=doi:10.18170/DVN/45LCSO',
            }],
          },
        })
      },
    },
  )
  assert.match(seen, /opendata\.pku\.edu\.cn\/api\/search/)
  assert.match(seen, /q=CFPS/)
  assert.equal(result.rows[0].doi, '10.18170/DVN/45LCSO')
})

test('nbsSnapshot reads a local CSV and filters year', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'research-nbs-'))
  const file = join(dir, 'nbs.csv')
  await writeFile(file, 'year,value,indicator\n2023,5.2,urban unemployment\n2024,5.1,urban unemployment\n', 'utf8')
  try {
    const result = await nbsSnapshot({ path: file, year: '2024' }, { root: dir })
    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0].value, '5.1')
    assert.match(result.note, /manual/i)
    const relative = await nbsSnapshot({ path: 'nbs.csv', year: '2024' }, { root: dir })
    assert.equal(relative.rows.length, 1)
    await assert.rejects(
      () => nbsSnapshot({ path: file }, { root: join(dir, 'other') }),
      /outside the NBS snapshot root/,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('openAlexSearch normalizes works and strips DOI/OpenAlex prefixes', async () => {
  let seen
  const result = await openAlexSearch(
    { query: 'social atomization', pageSize: 2 },
    {
      fetchImpl: async (url) => {
        seen = String(url)
        return jsonResponse({
          results: [{
            id: 'https://openalex.org/W1',
            doi: 'https://doi.org/10.1/x',
            title: 'A Theory',
            publication_year: 2025,
            cited_by_count: 3,
            primary_location: { source: { display_name: 'Journal' }, landing_page_url: 'https://example.org/a' },
            authorships: [{ author: { display_name: 'Alexsia Chan' } }],
          }],
        })
      },
    },
  )
  assert.match(seen, /api\.openalex\.org\/works/)
  assert.match(seen, /search=social\+atomization|search=social%20atomization/)
  assert.equal(result.rows[0].id, 'W1')
  assert.equal(result.rows[0].doi, '10.1/x')
  assert.equal(result.rows[0].year, 2025)
  assert.deepEqual(result.rows[0].authors, ['Alexsia Chan'])
})

test('crossrefSearch normalizes DOI metadata', async () => {
  let seen
  const result = await crossrefSearch(
    { query: 'completion status', pageSize: 2 },
    {
      fetchImpl: async (url) => {
        seen = String(url)
        return jsonResponse({
          message: {
            items: [{
              DOI: '10.1/y',
              title: ['Completion'],
              issued: { 'date-parts': [[2024]] },
              'container-title': ['Journal'],
              author: [{ given: 'A', family: 'B' }],
              URL: 'https://doi.org/10.1/y',
            }],
          },
        })
      },
    },
  )
  assert.match(seen, /api\.crossref\.org\/works/)
  assert.match(seen, /query=completion\+status|query=completion%20status/)
  assert.equal(result.rows[0].doi, '10.1/y')
  assert.equal(result.rows[0].year, 2024)
  assert.deepEqual(result.rows[0].authors, ['A B'])
})

