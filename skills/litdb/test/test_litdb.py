#!/usr/bin/env python3
"""Behavior tests for the read-only litdb CLI.

Seam: the four public subcommands (stats / relations / search / lookup) and the
read-only guarantee. The database is the real 1,560-record sample; tests never
write to it.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "litdb.py"
DEFAULT_DB = (
    Path(__file__).resolve().parents[4]
    / "dsh-porting-scan"
    / "_raw"
    / "hypothesis-generator"
    / "hypothesis-generator"
    / "assets"
    / "database"
    / "literature.db"
)
DB = Path(os.environ.get("RESEARCH_LITDB_TEST_DB", DEFAULT_DB))
KNOWN_SCAN_SHA = "294273E5F409C797AB67B01BCDF3B37F1B8E0A035320B21A975B7EA12AAA2202"


def run(*args: str) -> tuple[int, dict]:
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), *args, "--db", str(DB)],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        raise AssertionError(f"not JSON: stdout={proc.stdout!r} stderr={proc.stderr!r}")
    return proc.returncode, payload


class LitdbBehavior(unittest.TestCase):
    def test_db_exists(self):
        self.assertTrue(DB.is_file(), f"missing test DB: {DB}")

    def test_stats(self):
        before = hashlib.sha256(DB.read_bytes()).hexdigest()
        code, out = run("stats")
        after = hashlib.sha256(DB.read_bytes()).hexdigest()
        self.assertEqual(code, 0, out)
        self.assertEqual(out["total_rows"], 1560)
        self.assertEqual(out["journals"], {"中国社会科学": 520, "探索与争鸣": 520, "社会学研究": 520})
        self.assertEqual(out["year_min"], "2018")
        self.assertEqual(out["year_max"], "2026")
        self.assertEqual(out["field_count"], 9)
        self.assertEqual(before, after)

    def test_relations_page_one(self):
        code, out = run("relations", "--page", "1", "--page-size", "100")
        self.assertEqual(code, 0, out)
        self.assertEqual(out["mode"], "full_relation_scan")
        self.assertEqual(out["total_rows"], 1560)
        self.assertEqual(out["page_count"], 16)
        self.assertEqual(len(out["rows"]), 100)
        self.assertEqual(out["scan_sha256"], KNOWN_SCAN_SHA)
        self.assertEqual(set(out["rows"][0]), {"uid", "research_theme", "relationship_chain"})

    def test_search_three_char(self):
        code, out = run("search", "--query", "劳动控制", "--top-k", "5")
        self.assertEqual(code, 0, out)
        self.assertGreaterEqual(len(out["rows"]), 1)
        self.assertLessEqual(len(out["rows"]), 5)
        self.assertEqual(out["backend"], "lexical")

    def test_search_two_char_falls_back(self):
        code, out = run("search", "--query", "社会", "--top-k", "5")
        self.assertEqual(code, 0, out)
        self.assertGreaterEqual(len(out["rows"]), 1)
        self.assertEqual(out["backend"], "like")

    def test_lookup_nine_fields(self):
        code, out = run("lookup", "--uids", "SHXJ-2018-0299831416AE")
        self.assertEqual(code, 0, out)
        self.assertEqual(len(out["rows"]), 1)
        self.assertEqual(
            set(out["rows"][0]),
            {
                "uid", "title", "authors", "year", "journal", "abstract",
                "research_theme", "relationship_chain", "source_url",
            },
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
