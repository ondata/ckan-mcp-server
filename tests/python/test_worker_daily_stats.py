"""Tests for scripts/worker_daily_stats.sh (needs the duckdb CLI on PATH).

Run: python -m unittest discover -s tests/python
"""

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "worker_daily_stats.sh"

DAY = "2026-10-27"


def line(server, outcome="error", tool="ckan_status_show", **extra) -> dict:
    return {"id": f"{tool}-{server}-{outcome}", "timestamp": f"{DAY}T11:00:00Z", "outcome": outcome,
            "tool": tool, "server": server, "error": None, **extra}


EVENTS = [
    line("https://www.dati.gov.it/opendata", outcome="ok"),
    # failures on real portals
    line("https://open.ottawa.ca"),
    line("", tool="ckan_find_portals"),  # takes no server: a real failure
    line("https://open.toronto.ca", error_kind="timeout"),
    # runtime crash with no tool and no server: a real failure
    {"id": "crash", "timestamp": f"{DAY}T11:00:00Z", "outcome": "ok", "tool": None, "server": None,
     "error": "Stateless transport cannot be reused across requests"},
    # rejected input, legacy lines (no error_kind)
    line("test"),
    line({"not": "a string"}),
    line("https://example.com"),
    line("", tool="ckan_package_search"),
    # rejected input, with error_kind
    line("https://www.dati.gov.it/opendata", error_kind="validation"),
    line("http://169.254.169.254", error_kind="not_allowed"),
]


@unittest.skipUnless(shutil.which("duckdb"), "duckdb CLI not installed")
class DailyStatsTest(unittest.TestCase):
    def run_stats(self, events: list) -> list:
        with tempfile.TemporaryDirectory() as tmp:
            data = Path(tmp) / "data"
            data.mkdir()
            (data / "worker_events_flat.jsonl").write_text("".join(json.dumps(e) + "\n" for e in events))
            subprocess.run(["bash", str(SCRIPT)], cwd=tmp, check=True, capture_output=True)
            out = (data / "worker_daily_calls.jsonl").read_text()
        return [json.loads(row) for row in out.splitlines()]

    def test_invalid_input_is_counted_apart_from_errors(self):
        self.assertEqual(self.run_stats(EVENTS), [
            {"date": DAY, "calls": 11, "ok": 1, "errors": 4, "invalid_input": 6}
        ])

    def test_every_call_is_counted_once(self):
        row = self.run_stats(EVENTS)[0]
        self.assertEqual(row["calls"], row["ok"] + row["errors"] + row["invalid_input"])

    def test_file_without_error_kind_key_still_works(self):
        events = [{k: v for k, v in e.items() if k != "error_kind"} for e in EVENTS[:3]]
        self.assertEqual(self.run_stats(events), [
            {"date": DAY, "calls": 3, "ok": 1, "errors": 2, "invalid_input": 0}
        ])


if __name__ == "__main__":
    unittest.main()
