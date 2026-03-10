"""
Cloudflare Worker Telemetry Flattener
Trasforma worker_events.jsonl in una versione piatta con i campi essenziali.
Esclude i GET probe (senza tool).
"""

import json
import time
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
INPUT_FILE = DATA_DIR / "worker_events.jsonl"
OUTPUT_FILE = DATA_DIR / "worker_events_flat.jsonl"


def extract_query(source: dict) -> str | None:
    """Restituisce il termine di ricerca unificato dal source del tool."""
    # For ckan_find_portals, build a combined criteria string
    if source.get("tool") == "ckan_find_portals":
        parts = []
        for key in ("country", "query", "language", "has_datastore", "min_datasets"):
            val = source.get(key)
            if val is not None:
                parts.append(f"{key}={val}")
        return " ".join(parts) or None

    return (
        source.get("q")
        or source.get("query")
        or source.get("id")
        or source.get("pattern")
        or source.get("sql")
        or source.get("resource_id")
    )


def flatten(event: dict) -> dict | None:
    workers = event.get("$workers", {})
    metadata = event.get("$metadata", {})
    source = event.get("source", {})

    # Escludi GET probe (senza tool)
    method = workers.get("event", {}).get("request", {}).get("method")
    if method == "GET":
        return None

    # Converti timestamp ms → ISO 8601
    ts_ms = event.get("timestamp", 0)
    ts_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts_ms / 1000))

    return {
        "id": metadata.get("id"),
        "timestamp": ts_iso,
        "outcome": workers.get("outcome"),
        "tool": source.get("tool") if isinstance(source, dict) else None,
        "server": source.get("server") if isinstance(source, dict) else None,
        "query": extract_query(source) if isinstance(source, dict) else None,
        "error": metadata.get("error"),
    }


def run():
    with open(INPUT_FILE) as f_in, open(OUTPUT_FILE, "w") as f_out:
        total, written = 0, 0
        for line in f_in:
            total += 1
            event = json.loads(line)
            flat = flatten(event)
            if flat:
                f_out.write(json.dumps(flat) + "\n")
                written += 1

    print(f"Processati {total} eventi → {written} scritti in {OUTPUT_FILE}")
    print(f"  (esclusi {total - written} GET probe)")


if __name__ == "__main__":
    run()
