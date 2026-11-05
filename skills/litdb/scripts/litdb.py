#!/usr/bin/env python3
"""Read-only CLI for the local Chinese social-science literature sample.

Adapted for DeepSeek Harness from the MIT-licensed
`hypothesis-generator` literature_store.py contract:
  https://github.com/Skadi2333215/hypothesis-generator-openclaw-skill

The database is opened with `mode=ro` and `PRAGMA query_only=ON`. This script
never creates, migrates, updates or deletes anything. It intentionally has no
`init` command; data preparation stays outside the research workflow.

Commands:
  stats     --db PATH
  relations --db PATH --page N --page-size N
  search    --db PATH --query TEXT --top-k N
  lookup    --db PATH --uids UID [UID ...]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sqlite3
import sys
from contextlib import closing
from pathlib import Path
from typing import Any

FIELDS = (
    "uid", "title", "authors", "year", "journal", "abstract",
    "research_theme", "relationship_chain", "source_url",
)
MAX_PAGE_SIZE = 200
MAX_TOP_K = 50


class LitdbError(ValueError):
    """A contract violation the caller can fix."""


def configure_utf8_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8")


def emit(payload: Any, code: int = 0) -> int:
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return code


def fail(message: str, code: int = 2) -> int:
    return emit({"error": message}, code)


def default_db() -> Path:
    configured = os.environ.get("RESEARCH_LITDB_PATH")
    if configured:
        return Path(configured).expanduser()
    return Path.home() / ".dsh" / "research" / "knowledge" / "litdb" / "literature.db"


def resolve_db(raw: str | None) -> Path:
    path = Path(raw).expanduser() if raw else default_db()
    path = path.resolve()
    if not path.is_file():
        raise LitdbError(f"database not found: {path}")
    return path


def open_read_only(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only = ON")
    columns = [
        row["name"]
        for row in connection.execute("PRAGMA table_info(literature)").fetchall()
    ]
    if tuple(columns) != FIELDS:
        connection.close()
        raise LitdbError(
            "literature table does not match the nine-field contract: "
            + ", ".join(columns)
        )
    return connection


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def stats(path: Path) -> dict[str, Any]:
    with closing(open_read_only(path)) as connection:
        total = connection.execute("SELECT COUNT(*) FROM literature").fetchone()[0]
        journals = {
            row["journal"]: row["n"]
            for row in connection.execute(
                "SELECT journal, COUNT(*) AS n FROM literature GROUP BY journal ORDER BY journal"
            ).fetchall()
        }
        years = [
            (row["year"], row["n"])
            for row in connection.execute(
                "SELECT year, COUNT(*) AS n FROM literature GROUP BY year ORDER BY year"
            ).fetchall()
        ]
        fts_rows = connection.execute("SELECT COUNT(*) FROM literature_fts").fetchone()[0]
    return {
        "mode": "stats",
        "database": str(path),
        "sha256": file_sha256(path),
        "total_rows": total,
        "field_count": len(FIELDS),
        "fields": list(FIELDS),
        "journals": journals,
        "years": dict(years),
        "year_min": years[0][0] if years else None,
        "year_max": years[-1][0] if years else None,
        "fts_rows": fts_rows,
        "read_only": True,
    }


def relations(path: Path, page: int, page_size: int) -> dict[str, Any]:
    if page < 1:
        raise LitdbError("--page must be >= 1")
    if not 1 <= page_size <= MAX_PAGE_SIZE:
        raise LitdbError(f"--page-size must be 1..{MAX_PAGE_SIZE}")
    with closing(open_read_only(path)) as connection:
        rows = [
            dict(row)
            for row in connection.execute(
                "SELECT uid, research_theme, relationship_chain "
                "FROM literature ORDER BY uid COLLATE BINARY"
            ).fetchall()
        ]
    total = len(rows)
    page_count = max(1, math.ceil(total / page_size))
    if page > page_count:
        raise LitdbError(f"--page {page} exceeds page_count {page_count}")
    canonical = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    start = (page - 1) * page_size
    return {
        "mode": "full_relation_scan",
        "total_rows": total,
        "page": page,
        "page_size": page_size,
        "page_count": page_count,
        "scan_sha256": hashlib.sha256(canonical).hexdigest().upper(),
        "rows": rows[start : start + page_size],
    }


def search(path: Path, query: str, top_k: int) -> dict[str, Any]:
    query = query.strip()
    if not query:
        raise LitdbError("--query must not be empty")
    if not 1 <= top_k <= MAX_TOP_K:
        raise LitdbError(f"--top-k must be 1..{MAX_TOP_K}")

    # FTS5 trigram needs at least three Unicode characters for a substring
    # match; two-character Chinese queries fall back to LIKE.
    backend = "lexical" if len(query) >= 3 else "like"
    with closing(open_read_only(path)) as connection:
        if backend == "lexical":
            try:
                rows = [
                    dict(row)
                    for row in connection.execute(
                        "SELECT uid, research_theme, relationship_chain FROM literature_fts "
                        "WHERE literature_fts MATCH ? ORDER BY bm25(literature_fts), uid LIMIT ?",
                        (query, top_k),
                    ).fetchall()
                ]
            except sqlite3.Error:
                backend = "like"
        if backend == "like":
            pattern = f"%{query}%"
            rows = [
                dict(row)
                for row in connection.execute(
                    "SELECT uid, research_theme, relationship_chain FROM literature "
                    "WHERE title LIKE ? OR abstract LIKE ? OR research_theme LIKE ? "
                    "OR relationship_chain LIKE ? ORDER BY uid LIMIT ?",
                    (pattern, pattern, pattern, pattern, top_k),
                ).fetchall()
            ]
    return {"mode": "search", "backend": backend, "query": query, "top_k": top_k, "rows": rows}


def lookup(path: Path, uids: list[str]) -> dict[str, Any]:
    if not uids:
        raise LitdbError("--uids must not be empty")
    if any(not uid.strip() for uid in uids):
        raise LitdbError("--uids must not contain empty values")
    if len(set(uids)) != len(uids):
        raise LitdbError("--uids must not contain duplicates")
    placeholders = ",".join("?" for _ in uids)
    with closing(open_read_only(path)) as connection:
        found = {
            row["uid"]: dict(row)
            for row in connection.execute(
                f"SELECT {', '.join(FIELDS)} FROM literature WHERE uid IN ({placeholders})",
                uids,
            ).fetchall()
        }
    missing = [uid for uid in uids if uid not in found]
    if missing:
        raise LitdbError("unknown uid(s): " + ", ".join(missing))
    return {"mode": "lookup", "rows": [found[uid] for uid in uids]}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Read-only litdb queries for DeepSeek Harness.")
    parser.add_argument("--db", default=None, help="path to literature.db (defaults to $RESEARCH_LITDB_PATH or ~/.dsh/research/knowledge/litdb/literature.db)")
    sub = parser.add_subparsers(dest="command", required=True)

    p_stats = sub.add_parser("stats", help="row/journal/year counts and database hash")
    p_stats.add_argument("--db", default=argparse.SUPPRESS)

    p_rel = sub.add_parser("relations", help="paged full relation-chain scan")
    p_rel.add_argument("--db", default=argparse.SUPPRESS)
    p_rel.add_argument("--page", type=int, required=True)
    p_rel.add_argument("--page-size", type=int, default=100)

    p_search = sub.add_parser("search", help="FTS5/LIKE candidate search")
    p_search.add_argument("--db", default=argparse.SUPPRESS)
    p_search.add_argument("--query", required=True)
    p_search.add_argument("--top-k", type=int, default=30)

    p_lookup = sub.add_parser("lookup", help="full records by UID")
    p_lookup.add_argument("--db", default=argparse.SUPPRESS)
    p_lookup.add_argument("--uids", nargs="+", required=True)

    return parser


def main(argv: list[str] | None = None) -> int:
    configure_utf8_stdio()
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        path = resolve_db(args.db)
        if args.command == "stats":
            return emit(stats(path))
        if args.command == "relations":
            return emit(relations(path, args.page, args.page_size))
        if args.command == "search":
            return emit(search(path, args.query, args.top_k))
        if args.command == "lookup":
            return emit(lookup(path, args.uids))
        return fail(f"unknown command: {args.command}")
    except LitdbError as error:
        return fail(str(error))
    except sqlite3.Error as error:
        return fail(f"sqlite error: {error}")
    except OSError as error:
        return fail(f"io error: {error}")


if __name__ == "__main__":
    raise SystemExit(main())
