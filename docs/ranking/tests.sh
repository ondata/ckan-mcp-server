#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://www.dati.gov.it/opendata"
QUERIES=(
  "scuole"
  "scuole primarie"
  "disoccupazione giovanile"
  "violenza donne"
  "mobilita sostenibile"
  "qualita aria"
)

# Profiles
function run_default() {
  ckanapi action package_search -r "$BASE_URL" q="$1" rows=10 \
    | jq -r '.results[] | "\(.name)\t\(.title)\t\(.organization.title // .organization.name // "-")"'
}

function run_balanced() {
  ckanapi action package_search -r "$BASE_URL" q="$1" rows=10 \
    defType=edismax qf="title^10 tags^6 notes^2" tie=0.1 mm="2<75%" \
    | jq -r '.results[] | "\(.name)\t\(.title)\t\(.organization.title // .organization.name // "-")"'
}

function run_recency() {
  ckanapi action package_search -r "$BASE_URL" q="$1" rows=10 \
    defType=edismax qf="title^10 tags^6 notes^2" tie=0.1 mm="2<75%" \
    bf="recip(ms(NOW,metadata_modified),3.16e-11,1,1)" \
    | jq -r '.results[] | "\(.name)\t\(.title)\t\(.organization.title // .organization.name // "-")"'
}

function run_aggressive() {
  ckanapi action package_search -r "$BASE_URL" q="$1" rows=10 \
    defType=edismax qf="title^15 tags^8 notes^1" tie=0.2 mm="2<75%" \
    | jq -r '.results[] | "\(.name)\t\(.title)\t\(.organization.title // .organization.name // "-")"'
}

for q in "${QUERIES[@]}"; do
  echo "### QUERY: $q"
  echo "## default"
  run_default "$q"
  echo "## balanced"
  run_balanced "$q"
  echo "## recency"
  run_recency "$q"
  echo "## aggressive"
  run_aggressive "$q"
  echo
  sleep 0.2

done
