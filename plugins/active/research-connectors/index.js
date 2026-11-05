// @peishenglai3-hash/dsh-research-connectors — Host half.
//
// Six read-only research connectors, registered as native DSH tools. No DSH
// package is imported: the definitions use raw JSON Schema, which keeps this
// bundle dependency-free across rc upgrades. Every tool returns a JSON string
// so the canonical output contract is a single `string` schema.
import {
  dataCiteSearch,
  ilostatData,
  nbsSnapshot,
  openAlexSearch,
  pkuDataverseSearch,
  socArxivSearch,
  worldBankIndicator,
  crossrefSearch,
} from './lib/connectors.js'

export const name = 'research-connectors'
export const inject = ['tools']

const OUTPUT = {
  schema: { type: 'string' },
  render: (_args, value) => [{ type: 'text', text: String(value) }],
}

const MAX_TEXT = 200_000

function asText(value) {
  const text = JSON.stringify(value, null, 2)
  if (text.length <= MAX_TEXT) return text
  return JSON.stringify(
    {
      truncated: true,
      chars: text.length,
      note: `output truncated at ${MAX_TEXT} chars`,
      preview: text.slice(0, MAX_TEXT),
    },
    null,
    2,
  )
}

function tool(name, description, properties, required, run) {
  return {
    name,
    description,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties,
      required,
    },
    output: OUTPUT,
    isConcurrencySafe: () => true,
    async execute(args) {
      return asText(await run(args ?? {}))
    },
  }
}

const WORLD_BANK = tool(
  'research_worldbank_indicator',
  'Read World Bank Open Data indicator values for one country. Read-only; data are CC BY 4.0 (attribute World Bank). Use for inequality, development, labor and macro panels. Returns rows with country, date, value and indicator.',
  {
    country: { type: 'string', description: 'ISO 3166-1 alpha-3 country code, e.g. CHN or WLD.' },
    indicator: { type: 'string', description: 'World Bank indicator code, e.g. SI.POV.GINI.' },
    date: { type: 'string', description: 'Optional date range, e.g. 2015:2025.' },
    pageSize: { type: 'number', description: 'Rows per page, default 100.' },
  },
  ['country', 'indicator'],
  worldBankIndicator,
)

const DATACITE = tool(
  'research_datacite_search',
  'Search DataCite for dataset/software DOIs. Read-only; metadata licensing must be checked per record. Use for reproducible-research data discovery and DOI verification.',
  {
    query: { type: 'string', description: 'Free-text query.' },
    pageSize: { type: 'number', description: 'Results, default 10.' },
  },
  ['query'],
  dataCiteSearch,
)

const ILOSTAT = tool(
  'research_ilostat_data',
  'Read ILOSTAT SDMX data as CSV for one dataflow/key. Read-only; ILO terms must be reviewed before redistribution. Use for employment, labor share and digital inequality indicators.',
  {
    dataflow: { type: 'string', description: 'ILOSTAT dataflow id, e.g. DF_UNE_DEAP_SEX_AGE_RT.' },
    version: { type: 'string', description: 'Dataflow version, default 1.0.' },
    key: { type: 'string', description: 'SDMX key, e.g. A.CHN.' },
    startPeriod: { type: 'string', description: 'Optional start period, e.g. 2018.' },
    endPeriod: { type: 'string', description: 'Optional end period, e.g. 2024.' },
  },
  ['dataflow', 'key'],
  ilostatData,
)

const SOCARXIV = tool(
  'research_socarxiv_search',
  'Search OSF Preprints for SocArXiv records. Read-only; each preprint carries its own license. Use for social-science preprints that are absent from arXiv.',
  {
    query: { type: 'string', description: 'Title query.' },
    pageSize: { type: 'number', description: 'Results, default 10.' },
  },
  ['query'],
  socArxivSearch,
)

const PKU = tool(
  'research_pku_dataverse_search',
  'Search PKU Open Research Data (Dataverse) for dataset metadata, including CFPS metadata. Read-only; this returns metadata only, never raw microdata. Raw CFPS/CHARLS/CGSS data require an application and must not be redistributed.',
  {
    query: { type: 'string', description: 'Search query, e.g. CFPS.' },
    pageSize: { type: 'number', description: 'Results, default 10.' },
  },
  ['query'],
  pkuDataverseSearch,
)

const NBS = tool(
  'research_nbs_snapshot',
  'Read a user-exported National Bureau of Statistics of China CSV snapshot. NBS has no public automation API; this tool never scrapes. Read-only, local file only. The path must stay under $RESEARCH_NBS_DIR (default ~/.dsh/research/knowledge/nbs). CSV headers must include year/value/indicator.',
  {
    path: { type: 'string', description: 'Path to a CSV snapshot under $RESEARCH_NBS_DIR.' },
    year: { type: 'string', description: 'Optional four-digit year filter.' },
    indicator: { type: 'string', description: 'Optional indicator label filter.' },
  },
  ['path'],
  nbsSnapshot,
)

const OPENALEX = tool(
  'research_openalex_search',
  'Search OpenAlex (works) for titles, DOIs, venues, authors and citation counts. Read-only; metadata is CC0. Use for open scholarly discovery and DOI verification; no API key required.',
  {
    query: { type: 'string', description: 'Free-text search query.' },
    pageSize: { type: 'number', description: 'Results 1-50; default 10.' },
  },
  ['query'],
  openAlexSearch,
)

const CROSSREF = tool(
  'research_crossref_search',
  'Search Crossref for DOI metadata: title, authors, year, venue. Read-only; metadata terms apply. Use for citation and DOI verification.',
  {
    query: { type: 'string', description: 'Free-text search query.' },
    pageSize: { type: 'number', description: 'Results 1-50; default 10.' },
  },
  ['query'],
  crossrefSearch,
)

const TOOLS = [WORLD_BANK, DATACITE, ILOSTAT, SOCARXIV, PKU, NBS, OPENALEX, CROSSREF]

export function apply(ctx) {
  for (const definition of TOOLS) {
    try {
      ctx.effect(
        () => ctx.tools.register(definition),
        `research-connectors:${definition.name}`,
      )
    } catch (error) {
      // A single bad schema must not take the whole profile down.
      ctx.logger?.warn?.(`research-connectors: failed to register ${definition.name}: ${String(error)}`)
    }
  }
}
