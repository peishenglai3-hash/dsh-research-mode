# research-connectors

Six read-only social-science connectors for Research Mode:

| tool | source | notes |
|---|---|---|
| `research_worldbank_indicator` | World Bank Open Data | CC BY 4.0; no key |
| `research_datacite_search` | DataCite REST | metadata only |
| `research_ilostat_data` | ILOSTAT SDMX | **UNKNOWN / P1**: tested keys return HTTP 422/500; not a Phase 1 P0 pass |
| `research_socarxiv_search` | OSF Preprints / SocArXiv | per-preprint license |
| `research_pku_dataverse_search` | PKU Dataverse | metadata only; no raw microdata |
| `research_nbs_snapshot` | local CSV snapshot | NBS has no public automation API; never scrapes. The path must stay under `$RESEARCH_NBS_DIR` (default `~/.dsh/research/knowledge/nbs`) |

## Install (test profile)

```bash
dsh plugin --profile researchtest add "<workspace>/dsh-plugins/..."
```

Then `dsh --profile researchtest --dump-config` and confirm the `research-connectors` row. Do not install into `desktop` until Phase 0 acceptance.

## Safety

- Every tool is read-only. No tool writes files, uploads data, or bypasses paywalls.
- `research_nbs_snapshot` reads a user-exported CSV; it never scrapes NBS.
- CFPS/CHARLS/CGSS raw microdata are **not** connectors; they require an application and must not be redistributed.
- `research_ilostat_data` returns CSV; review ILO/OECD terms before redistribution.
