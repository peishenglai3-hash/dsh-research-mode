# Evidence model

This is the part worth reading before trusting any output of this tool.

## Objects

```text
Project ── Artifact ── Provenance (7 faces)
             │
             └── Review (per-round history + content signature)
```

- An **Artifact** is immutable. Its identity is `sha256(bytes)`. The payload lives at
  `artifacts/<sha256>`; a sidecar `artifacts/<sha256>.json` carries metadata and provenance.
- Recording identical bytes twice does **not** create a second artifact; the existing one is returned.
- A **Review** lives in `reviews/<artifactId>.json`, holds a top-level mirror of the latest round
  plus a `history[]` of every round, and never modifies the artifact bytes.

## The seven faces

| Face | Recorded from | Means |
|---|---|---|
| `code` | caller | producer code, if provided |
| `execution` | caller (`log`) | what was run / observed |
| `environment` | caller, else auto-filled | environment metadata |
| `messages` | caller | immutable message snapshot anchor |
| `reproducibility` | **computed** | `{checksum, bytes, source}` |
| `review` | derived at read time | whether a review record exists |
| `literature` | caller | citation locators (free text) |

Each face is either `{status: "available", value}` or `{status: "unavailable", reason}`.

## Read the statuses precisely

```text
reproducibility.available  →  "there is a checksum"        NOT "it was reproduced"
environment.available      →  "there is an env record"     NOT "the env is complete"
review.available           →  "a review record exists"     NOT "a human reviewed it"
literature.available       →  "locators were entered"      NOT "the citation is correct"
```

Two of these are easy to misread, so they get a callout:

1. **`environment` is auto-filled when omitted.** If the value has only
   `{platform, arch, node, python}`, it is the default, not a record of your real environment.
2. **`reproducibility` is computed, not observed.** There is no replay in this release. A face
   named "reproducibility" that says `available` because a checksum exists is, at best, a
   statement about *checkability*.

## Review signatures

Each round stores `signature = sha256(JSON of that round's fields)`. It is an **unkeyed** hash.

What `research_review_verify` establishes: every round's stored fields still hash to that round's
signature.

What it does **not** establish:

- **Identity.** Anyone who can edit the file can recompute a valid signature. It is tamper-evidence,
  not authentication.
- **Completeness.** A single file cannot prove that older rounds were not deleted or reordered.
- **Correctness.** Signing a wrong claim still yields `valid: true`.

Legacy rounds without a `signature` are reported as unverifiable — deliberately, rather than being
counted as valid.

## Archival format (`.science`)

`tar` + `gzip` containing:

```text
science-manifest.json     { format: "science/1", project, createdAt, readOnly, files[{path,sha256,bytes}] }
ro-crate-metadata.json    minimal RO-Crate 1.1 description
payload/project.json
payload/artifacts/*
payload/reviews/*
```

Import validates every declared checksum, rejects undeclared or missing files, refuses path
traversal, and cleans up a half-written import. It does **not** make the imported tree filesystem
read-only; `readOnly` is a declaration plus a measured `readOnlyEnforced` flag.

## Why this shape

Because research output has to survive being handed to someone who does not trust you. A
conversation transcript does not. A file tree of checksummed artifacts, with an explicit list of
what was *not* checked, does — as long as the reader knows which fields mean what, which is what
this document is for.
