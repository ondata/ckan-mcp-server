#!/usr/bin/env python3
"""
Phase 1: generate synthetic NL queries from real tool call logs.

Reads data/worker_events_flat.jsonl, keeps top-8 tools, calls Gemini
to generate one natural-language query per record, saves to
data/nl_eval_queries.jsonl.

Usage:
    uv run --with litellm generate_nl_queries.py
    uv run --with litellm generate_nl_queries.py --limit 20   # test on first 20
    uv run --with litellm generate_nl_queries.py --batch 5    # 5 records per LLM call
"""

import argparse
import json
import time
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
INPUT  = ROOT / "data" / "worker_events_flat.jsonl"
OUTPUT = ROOT / "data" / "nl_eval_queries.jsonl"

TOP_TOOLS = {
    "ckan_package_search",
    "ckan_package_show",
    "ckan_find_relevant_datasets",
    "ckan_status_show",
    "sparql_query",
    "ckan_list_resources",
    "ckan_find_portals",
    "ckan_datastore_search",
}

SYSTEM_PROMPT = """\
You generate training data for a tool-selection classifier.
Given a list of real API calls (tool name + query parameter + server URL),
produce one natural-language question per call that a real user might type
in a chat interface to trigger exactly that tool.

Rules:
- Sound natural, like a real user — no jargon, no API names
- Match the language of the query field (Italian query → Italian question, English → English)
- Do NOT mention the tool name
- 1-2 sentences max
- Vary phrasing across items

Reply with a JSON array of strings, one per input item, in the same order.
Example output for 3 items: ["question 1", "question 2", "question 3"]
"""

def load_records() -> list[dict]:
    records = []
    with INPUT.open() as f:
        for line in f:
            r = json.loads(line)
            if r.get("tool") in TOP_TOOLS:
                records.append(r)
    return records


def load_done_ids() -> set[str]:
    if not OUTPUT.exists():
        return set()
    done = set()
    with OUTPUT.open() as f:
        for line in f:
            done.add(json.loads(line)["id"])
    return done


def build_user_message(batch: list[dict]) -> str:
    items = []
    for r in batch:
        items.append({
            "tool": r["tool"],
            "query": r.get("query", ""),
            "server": r.get("server", ""),
        })
    return json.dumps(items, ensure_ascii=False, indent=2)


def call_gemini(batch: list[dict], model: str) -> list[str]:
    import litellm
    response = litellm.completion(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_message(batch)},
        ],
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content
    # Gemini may wrap in an object — unwrap if needed
    parsed = json.loads(raw)
    if isinstance(parsed, list):
        return parsed
    # look for the first list value
    for v in parsed.values():
        if isinstance(v, list):
            return v
    raise ValueError(f"Unexpected response format: {raw[:200]}")


def main():
    parser = argparse.ArgumentParser(description="Generate NL queries from tool call logs")
    parser.add_argument("--limit", type=int, default=0, help="Process only first N records (0 = all)")
    parser.add_argument("--batch", type=int, default=10, help="Records per LLM call (default 10)")
    parser.add_argument("--model", default="gemini/gemini-2.5-flash", help="LiteLLM model string")
    parser.add_argument("--sleep", type=float, default=6.5, help="Seconds between API calls (default 6.5s = ~9 RPM, safe for free tier)")
    args = parser.parse_args()

    records = load_records()
    done_ids = load_done_ids()

    pending = [r for r in records if r["id"] not in done_ids]
    if args.limit:
        pending = pending[: args.limit]

    total = len(pending)
    print(f"Records to process : {total}  (already done: {len(done_ids)})")
    print(f"Model              : {args.model}")
    print(f"Batch size         : {args.batch}")
    print(f"Estimated calls    : {-(-total // args.batch)}")
    print()

    if total == 0:
        print("Nothing to do.")
        return

    out = OUTPUT.open("a")
    processed = 0
    errors = 0

    for i in range(0, total, args.batch):
        batch = pending[i : i + args.batch]
        try:
            nl_queries = call_gemini(batch, args.model)
            if len(nl_queries) != len(batch):
                print(f"  [warn] expected {len(batch)} answers, got {len(nl_queries)} — skipping batch", file=sys.stderr)
                errors += len(batch)
                continue
            for r, nl in zip(batch, nl_queries):
                out.write(json.dumps({
                    "id": r["id"],
                    "nl_query": nl,
                    "tool": r["tool"],
                    "server": r.get("server", ""),
                    "original_query": r.get("query", ""),
                }, ensure_ascii=False) + "\n")
            processed += len(batch)
            pct = processed / total * 100
            print(f"  [{processed}/{total} {pct:.0f}%] batch {i // args.batch + 1} ok")
            out.flush()
        except Exception as e:
            print(f"  [error] batch {i // args.batch + 1}: {e}", file=sys.stderr)
            errors += len(batch)

        if i + args.batch < total:
            time.sleep(args.sleep)

    out.close()
    print()
    print(f"Done. Saved {processed} records to {OUTPUT}")
    if errors:
        print(f"Errors/skipped: {errors}")


if __name__ == "__main__":
    main()
