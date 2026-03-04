"""
Cloudflare Worker Telemetry Archiver
Scarica eventi di telemetria del Worker e li archivia in JSONL.
Legge CF_API_TOKEN da env var (GHA) o da .env nella root del progetto.
Dopo ogni fetch fa merge+dedup+sort (timestamp desc) sul file di output.
"""

import json
import os
import time
from pathlib import Path

import requests

# Carica .env dalla root del progetto (fallback rispetto a env var di sistema)
env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            k = k.strip()
            if k not in os.environ:  # env var di sistema ha priorità
                os.environ[k] = v.strip().strip('"')

ACCOUNT_ID = os.environ.get("CF_ACCOUNT_ID", "c89b6bdafbbb793bf64cfa3b271fa5a4")
API_TOKEN = os.environ.get("CF_API_TOKEN", "")
DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)
OUTPUT_FILE = DATA_DIR / "worker_events.jsonl"
STATE_FILE = DATA_DIR / "worker_telemetry_last_run.json"
DAY_MS = 86400 * 1000


def get_last_run_ms(backfill_days=1):
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())["last_run_ms"]
    return int(time.time() * 1000) - backfill_days * DAY_MS


def save_last_run_ms(ms):
    STATE_FILE.write_text(json.dumps({"last_run_ms": ms}))


def fetch_events(from_ms, to_ms):
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}"
        "/workers/observability/telemetry/query"
    )
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json",
    }
    all_events, offset = [], None

    while True:
        # queryId univoco per ogni run: evita che l'API riusi la query salvata
        body = {
            "queryId": f"archiver-{to_ms}",
            "timeframe": {"from": from_ms, "to": to_ms},
            "view": "events",
            "limit": 2000,
            "parameters": {
                "filters": [
                    {
                        "key": "$metadata.type",
                        "operation": "eq",
                        "type": "string",
                        "value": "cf-worker",
                    }
                ],
                "filterCombination": "and",
                "orderBy": {"value": "timestamp", "order": "asc"},
            },
        }
        if offset:
            body["offset"] = offset

        resp = requests.post(url, headers=headers, json=body)
        if not resp.ok:
            print(f"  ERRORE {resp.status_code}: {resp.text}")
            resp.raise_for_status()

        data = resp.json()
        events = data.get("result", {}).get("events", {}).get("events", [])
        all_events.extend(events)
        print(f"  Scaricati {len(events)} eventi (totale: {len(all_events)})")

        next_offset = data.get("result", {}).get("events", {}).get("nextOffset")
        if not next_offset or len(events) == 0:
            break
        offset = next_offset

    return all_events


def merge_dedup_sort(new_events):
    """Unisce nuovi eventi con quelli esistenti, dedup per id, sort timestamp desc."""
    existing = {}
    if OUTPUT_FILE.exists():
        for line in OUTPUT_FILE.read_text().splitlines():
            if line.strip():
                e = json.loads(line)
                eid = e.get("$metadata", {}).get("id")
                if eid:
                    existing[eid] = e

    for e in new_events:
        eid = e.get("$metadata", {}).get("id")
        if eid:
            existing[eid] = e

    merged = sorted(existing.values(), key=lambda e: e.get("timestamp", 0), reverse=True)

    with open(OUTPUT_FILE, "w") as f:
        for e in merged:
            f.write(json.dumps(e) + "\n")

    return len(merged)


def run(once=True, backfill_days=1):
    """
    once=True        → esegui una volta sola
    once=False       → loop ogni 24 ore (modalità daemon)
    backfill_days    → giorni da recuperare alla prima esecuzione (default 1, max 7)
                       usa chunk da 24h per evitare downsampling API
    """
    while True:
        now_ms = int(time.time() * 1000)
        from_ms = get_last_run_ms(backfill_days)

        # Suddividi in chunk da 24h per evitare downsampling
        chunks = []
        cursor = from_ms
        while cursor < now_ms:
            chunk_end = min(cursor + DAY_MS, now_ms)
            chunks.append((cursor, chunk_end))
            cursor = chunk_end

        all_events = []
        for chunk_from, chunk_to in chunks:
            from_dt = time.strftime("%Y-%m-%d %H:%M", time.localtime(chunk_from / 1000))
            to_dt = time.strftime("%Y-%m-%d %H:%M", time.localtime(chunk_to / 1000))
            print(f"Chunk: {from_dt} → {to_dt}")
            events = fetch_events(chunk_from, chunk_to)
            all_events.extend(events)

        total = merge_dedup_sort(all_events)
        if all_events:
            print(f"  Nuovi: {len(all_events)} | Totale file: {total} | {OUTPUT_FILE}")
        else:
            print("  Nessun evento nuovo.")

        save_last_run_ms(now_ms)

        if once:
            break
        print("Aspetto 24 ore...\n")
        time.sleep(DAY_MS // 1000)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Cloudflare Worker Telemetry Archiver")
    parser.add_argument("--daemon", action="store_true", help="Loop ogni 24 ore")
    parser.add_argument(
        "--backfill-days",
        type=int,
        default=1,
        help="Giorni da recuperare alla prima esecuzione (default: 1, max: 7)",
    )
    args = parser.parse_args()

    run(once=not args.daemon, backfill_days=args.backfill_days)
