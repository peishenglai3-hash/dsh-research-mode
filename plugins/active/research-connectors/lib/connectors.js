// Read-only connector primitives for the research-connectors Host plugin.
//
// Every function accepts an injected fetch/read implementation so the public
// behavior can be tested without network access. No function writes files.

import { readFile, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve, sep } from 'node:path'

const UA = 'dsh-research-connectors/0.1 (+local research workspace)'
const TIMEOUT_MS = 30_000

async function requestJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { accept: 'application/json', 'user-agent': UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`)
  return response.json()
}

async function requestText(url, fetchImpl) {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { accept: 'text/csv,text/plain,*/*', 'user-agent': UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`)
  return response.text()
}

export async function worldBankIndicator({ country, indicator, date, pageSize = 100 }, { fetchImpl = fetch } = {}) {
  if (!country || !indicator) throw new Error('worldBankIndicator: country and indicator are required')
  const url = new URL(`https://api.worldbank.org/v2/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicator)}`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', String(pageSize))
  if (date) url.searchParams.set('date', date)
  const payload = await requestJson(url, fetchImpl)
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
    throw new Error('worldBankIndicator: unexpected response envelope')
  }
  return {
    source: 'worldbank',
    indicator,
    country,
    url: String(url),
    rows: payload[1].map((row) => ({
      country: row?.country?.value ?? null,
      countryCode: row?.countryiso3code ?? null,
      date: row?.date ?? null,
      value: row?.value ?? null,
      indicator: row?.indicator?.value ?? null,
    })),
  }
}

export async function openAlexSearch({ query, pageSize = 10 }, { fetchImpl = fetch } = {}) {
  if (!query) throw new Error('openAlexSearch: query is required')
  const url = new URL('https://api.openalex.org/works')
  url.searchParams.set('search', query)
  url.searchParams.set('per-page', String(Math.min(50, Math.max(1, pageSize))))
  const payload = await requestJson(url, fetchImpl)
  const rows = Array.isArray(payload?.results) ? payload.results : []
  return {
    source: 'openalex',
    query,
    url: String(url),
    rows: rows.map((item) => ({
      id: String(item?.id ?? '').replace(/^https:\/\/openalex\.org\//, '') || null,
      doi: String(item?.doi ?? '').replace(/^https:\/\/doi\.org\//, '') || null,
      title: item?.title ?? null,
      year: item?.publication_year ?? null,
      citedBy: item?.cited_by_count ?? null,
      venue: item?.primary_location?.source?.display_name ?? null,
      authors: (item?.authorships ?? []).slice(0, 5).map((entry) => entry?.author?.display_name).filter(Boolean),
      url: item?.primary_location?.landing_page_url ?? item?.doi ?? null,
    })),
  }
}

export async function crossrefSearch({ query, pageSize = 10 }, { fetchImpl = fetch } = {}) {
  if (!query) throw new Error('crossrefSearch: query is required')
  const url = new URL('https://api.crossref.org/works')
  url.searchParams.set('query', query)
  url.searchParams.set('rows', String(Math.min(50, Math.max(1, pageSize))))
  const payload = await requestJson(url, fetchImpl)
  const rows = Array.isArray(payload?.message?.items) ? payload.message.items : []
  return {
    source: 'crossref',
    query,
    url: String(url),
    rows: rows.map((item) => ({
      doi: item?.DOI ?? null,
      title: item?.title?.[0] ?? null,
      year: item?.issued?.['date-parts']?.[0]?.[0] ?? null,
      venue: item?.['container-title']?.[0] ?? null,
      authors: (item?.author ?? []).slice(0, 5).map((author) => [author?.given, author?.family].filter(Boolean).join(' ')).filter(Boolean),
      url: item?.URL ?? null,
    })),
  }
}

export async function dataCiteSearch({ query, pageSize = 10 }, { fetchImpl = fetch } = {}) {
  if (!query) throw new Error('dataCiteSearch: query is required')
  const url = new URL('https://api.datacite.org/dois')
  url.searchParams.set('query', query)
  url.searchParams.set('page[size]', String(pageSize))
  const payload = await requestJson(url, fetchImpl)
  const rows = Array.isArray(payload?.data) ? payload.data : []
  return {
    source: 'datacite',
    query,
    url: String(url),
    rows: rows.map((item) => ({
      doi: item?.attributes?.doi ?? item?.id ?? null,
      title: item?.attributes?.titles?.[0]?.title ?? null,
      publisher: item?.attributes?.publisher ?? null,
      publicationYear: item?.attributes?.publicationYear ?? null,
      url: item?.attributes?.url ?? null,
      resourceType: item?.attributes?.types?.resourceTypeGeneral ?? null,
    })),
  }
}

export async function ilostatData({ dataflow, version = '1.0', key, startPeriod, endPeriod }, { fetchImpl = fetch } = {}) {
  if (!dataflow || !key) throw new Error('ilostatData: dataflow and key are required')
  const path = `ILO,${encodeURIComponent(dataflow)},${encodeURIComponent(version)}/${key}`
  const url = new URL(`https://sdmx.ilo.org/rest/data/${path}`)
  url.searchParams.set('format', 'csv')
  if (startPeriod) url.searchParams.set('startPeriod', startPeriod)
  if (endPeriod) url.searchParams.set('endPeriod', endPeriod)
  const csv = await requestText(url, fetchImpl)
  return { source: 'ilostat', dataflow, version, key, url: String(url), csv }
}

export async function socArxivSearch({ query, pageSize = 10 }, { fetchImpl = fetch } = {}) {
  if (!query) throw new Error('socArxivSearch: query is required')
  const url = new URL('https://api.osf.io/v2/preprints/')
  url.searchParams.set('filter[provider]', 'socarxiv')
  url.searchParams.set('filter[title]', query)
  url.searchParams.set('page[size]', String(pageSize))
  const payload = await requestJson(url, fetchImpl)
  let items = Array.isArray(payload?.data) ? payload.data : []
  let backend = 'title-filter'

  // OSF's filter[title] behaves as an exact/substring title filter: a multi-word
  // query such as "social atomization" can return 0 even when related preprints
  // exist. Fall back to a bounded recent list and rank by token hits.
  if (items.length === 0 && query.trim().includes(' ')) {
    const broad = new URL('https://api.osf.io/v2/preprints/')
    broad.searchParams.set('filter[provider]', 'socarxiv')
    broad.searchParams.set('page[size]', '100')
    const all = await requestJson(broad, fetchImpl)
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
    const scored = (Array.isArray(all?.data) ? all.data : []).map((item) => {
      const text = `${item?.attributes?.title ?? ''} ${item?.attributes?.description ?? ''}`.toLowerCase()
      return {
        item,
        all: tokens.every((token) => text.includes(token)),
        hits: tokens.filter((token) => text.includes(token)).length,
      }
    })
    const strict = scored.filter((entry) => entry.all)
    const pool = strict.length > 0 ? strict : scored.filter((entry) => entry.hits > 0)
    items = pool
      .sort((left, right) => right.hits - left.hits)
      .slice(0, pageSize)
      .map((entry) => entry.item)
    backend = strict.length > 0 ? 'list-filter-all-tokens' : 'list-filter-any-token'
  }

  return {
    source: 'socarxiv',
    query,
    backend,
    url: String(url),
    rows: items.map((item) => ({
      id: item?.id ?? null,
      title: item?.attributes?.title ?? null,
      datePublished: item?.attributes?.date_published ?? null,
      description: item?.attributes?.description ?? null,
      url: item?.links?.html ?? null,
    })),
  }
}

export async function pkuDataverseSearch({ query, pageSize = 10 }, { fetchImpl = fetch } = {}) {
  if (!query) throw new Error('pkuDataverseSearch: query is required')
  const url = new URL('https://opendata.pku.edu.cn/api/search')
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'dataset')
  url.searchParams.set('per_page', String(pageSize))
  const payload = await requestJson(url, fetchImpl)
  const rows = payload?.data?.items ?? payload?.data?.datasets ?? payload?.items ?? []
  const list = Array.isArray(rows) ? rows : []
  return {
    source: 'pku-dataverse',
    query,
    url: String(url),
    rows: list.map((item) => ({
      name: item?.name ?? item?.title ?? null,
      doi: (item?.doi ?? item?.global_id ?? null)?.replace(/^doi:/i, '') ?? null,
      url: item?.url ?? item?.persistentUrl ?? null,
    })),
  }
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) return []
  const headers = lines[0].split(',').map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim())
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

export async function nbsSnapshot({ path, year, indicator }, { readFileImpl = readFile, root } = {}) {
  if (!path) throw new Error('nbsSnapshot: path is required')
  const rootInput = resolve(root ?? process.env.RESEARCH_NBS_DIR ?? join(homedir(), '.dsh', 'research', 'knowledge', 'nbs'))
  const allowedRoot = await realpath(rootInput).catch(() => rootInput)
  const candidate = isAbsolute(path) ? path : join(allowedRoot, path)
  const absolute = await realpath(candidate)
  if (absolute !== allowedRoot && !absolute.startsWith(allowedRoot + sep)) {
    throw new Error(`nbsSnapshot: path is outside the NBS snapshot root (${allowedRoot})`)
  }
  const text = await readFileImpl(absolute, 'utf8')
  const rows = parseCsv(text).filter((row) => {
    if (year && row.year !== String(year)) return false
    if (indicator && row.indicator && row.indicator !== indicator) return false
    return true
  })
  return {
    source: 'nbs-snapshot',
    path: absolute,
    year: year ?? null,
    indicator: indicator ?? null,
    rows,
    note: 'Manual CSV snapshot: NBS has no public automation API; data are user-exported and read-only.',
  }
}
