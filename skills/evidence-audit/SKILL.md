---
name: evidence-audit
description: "Audit an evidence table or claim chain for source coverage, citation traceability, contrary evidence and unsupported inference. Use before accepting a literature summary or report."
---

# Evidence audit

Use on an evidence table, literature summary or empirical claim chain.

## Checks

1. Every claim has a source with title and identifier (DOI/URL/UID); missing identifiers are marked UNKNOWN.
2. Each source is labelled by type and scope: peer-reviewed article, preprint, book chapter, dataset metadata, local sample.
3. Local samples are named as samples; never described as complete journal coverage.
4. Contrary or null findings are listed, not only supporting citations.
5. The inference level is explicit: observation, association, mechanism, causal claim.
6. Unread full texts are marked “metadata/abstract only”.

## Output

Produce a short audit table: claim, source, evidence level, gap. Do not rewrite the author's argument.
