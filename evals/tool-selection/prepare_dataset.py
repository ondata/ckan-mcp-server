#!/usr/bin/env python3
"""
Phase 2: split nl_eval_queries.jsonl into train/eval and push to HuggingFace Hub.

- Stratified split: 80% train, 20% eval (per tool)
- Saves data/train.jsonl and data/eval.jsonl locally
- Pushes dataset to HuggingFace Hub as a DatasetDict

Usage:
    uv run --with "datasets huggingface_hub" prepare_dataset.py
    uv run --with "datasets huggingface_hub" prepare_dataset.py --repo your-username/ckan-tool-selection
    uv run --with "datasets huggingface_hub" prepare_dataset.py --dry-run
"""

import argparse
import json
import random
from collections import defaultdict
from pathlib import Path

ROOT   = Path(__file__).parent.parent.parent
INPUT  = ROOT / "data" / "nl_eval_queries.jsonl"
TRAIN  = ROOT / "data" / "train.jsonl"
EVAL   = ROOT / "data" / "eval.jsonl"

SEED       = 42
EVAL_RATIO = 0.2


def load_records() -> list[dict]:
    records = []
    with INPUT.open() as f:
        for line in f:
            records.append(json.loads(line))
    return records


def stratified_split(records: list[dict], eval_ratio: float, seed: int):
    random.seed(seed)
    by_tool: dict[str, list] = defaultdict(list)
    for r in records:
        by_tool[r["tool"]].append(r)

    train, eval_ = [], []
    for tool, items in sorted(by_tool.items()):
        random.shuffle(items)
        n_eval = max(1, int(len(items) * eval_ratio))
        eval_.extend(items[:n_eval])
        train.extend(items[n_eval:])

    random.shuffle(train)
    random.shuffle(eval_)
    return train, eval_


def write_jsonl(path: Path, records: list[dict]):
    with path.open("w") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def print_stats(label: str, records: list[dict]):
    from collections import Counter
    counts = Counter(r["tool"] for r in records)
    print(f"\n{label} ({len(records)} records):")
    for tool, n in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {n:4d}  {tool}")


def push_to_hub(repo: str):
    from datasets import Dataset, DatasetDict

    train_data = [json.loads(l) for l in TRAIN.open()]
    eval_data  = [json.loads(l) for l in EVAL.open()]

    ds = DatasetDict({
        "train": Dataset.from_list(train_data),
        "test":  Dataset.from_list(eval_data),
    })
    print(f"\nPushing to HuggingFace Hub: {repo}")
    ds.push_to_hub(repo, private=False)
    print(f"Done: https://huggingface.co/datasets/{repo}")


def main():
    parser = argparse.ArgumentParser(description="Split dataset and push to HuggingFace Hub")
    parser.add_argument("--repo", default="", help="HF repo id, e.g. username/ckan-tool-selection")
    parser.add_argument("--eval-ratio", type=float, default=EVAL_RATIO)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--dry-run", action="store_true", help="Split and print stats, don't push")
    args = parser.parse_args()

    records = load_records()
    print(f"Loaded {len(records)} records from {INPUT.name}")

    train, eval_ = stratified_split(records, args.eval_ratio, args.seed)
    print_stats("TRAIN", train)
    print_stats("EVAL", eval_)

    write_jsonl(TRAIN, train)
    write_jsonl(EVAL, eval_)
    print(f"\nSaved: {TRAIN.name} ({len(train)}) and {EVAL.name} ({len(eval_)})")

    if args.dry_run:
        print("\n[dry-run] Skipping HuggingFace push.")
        return

    if not args.repo:
        print("\nNo --repo specified. Skipping HuggingFace push.")
        print("Run with: --repo your-username/ckan-tool-selection")
        return

    push_to_hub(args.repo)


if __name__ == "__main__":
    main()
