"""Tests for flatten() in scripts/worker_telemetry_archiver.py.

Run: uv run --no-project --with requests python -m unittest discover -s tests/python
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

from worker_telemetry_archiver import FLAT_FIELDS, flatten  # noqa: E402


def event(source: dict) -> dict:
    return {
        "timestamp": 0,
        "$metadata": {"id": "evt"},
        "$workers": {"event": {"request": {"method": "POST"}}},
        "source": source,
    }


class FlattenSearchResultsTest(unittest.TestCase):
    def test_zero_results_with_omitted_lists_become_empty_lists(self):
        # The Observability API drops empty arrays from source
        flat = flatten(event({"tool": "ckan_package_search", "q": "x", "result_count": 0, "result_start": 0}))
        self.assertEqual(flat["result_count"], 0)
        self.assertEqual(flat["result_ids"], [])
        self.assertEqual(flat["result_names"], [])

    def test_non_empty_lists_are_kept(self):
        flat = flatten(event({
            "tool": "ckan_package_search",
            "q": "rifiuti",
            "result_count": 471,
            "result_start": 0,
            "result_ids": ["id-1", "id-2"],
            "result_names": ["rifiuti-2023", "rifiuti-2024"],
        }))
        self.assertEqual(flat["result_ids"], ["id-1", "id-2"])
        self.assertEqual(flat["result_names"], ["rifiuti-2023", "rifiuti-2024"])

    def test_non_search_event_keeps_null_lists(self):
        flat = flatten(event({"tool": "ckan_package_show", "id": "rifiuti-2024"}))
        self.assertIsNone(flat["result_count"])
        self.assertIsNone(flat["result_ids"])
        self.assertIsNone(flat["result_names"])

    def test_every_flat_field_is_present(self):
        flat = flatten(event({"tool": "ckan_package_show", "id": "x"}))
        self.assertEqual(set(flat), set(FLAT_FIELDS))


if __name__ == "__main__":
    unittest.main()
