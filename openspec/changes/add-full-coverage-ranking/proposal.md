# Rank on full-term coverage, from the portal's own search

## Why

`ckan_find_relevant_datasets` re-ranks locally the first 50 candidates that `package_search`
returns. On `defibrillatori Comune di Lecce` (dati.gov.it) three datasets tied at 9.7 and the
right one led on Solr's order, not on score (#539). Measured on the real candidate set:

- the fix the issue proposed, IDF over the candidates, makes it worse — the Lecce dataset
  drops out of the top three, because `lecce` is rarer than `comune` in that set and the
  "patrocini" datasets carry it in every field;
- the tag score was lost to `defibrillatore` (singular, in the tag) never matching
  `defibrillatori` (plural, in the query): the matcher compared whole words;
- on `qualità dell'aria Milano`, none of the 50 candidates mentioned Milano at all. No local
  re-ranking can surface a dataset the portal never returned.

The lever is upstream. `mm` is on CKAN's `VALID_SOLR_PARAMETERS`; with `mm=100%` Solr
returns only datasets carrying every query term, matched with its own stemming across `qf`:
the Lecce query returns exactly one dataset, the Milano query returns the Comune di Milano
reports first, `incidenti stradali Palermo` returns 20 datasets, all Palermo. Verified on
dati.gov.it, dati.comune.milano.it, Toronto and Zurich.

## What Changes

- **Strict pass first.** Candidates are fetched with `mm=100%`; when they are fewer than
  `limit`, a default pass fills in. Datasets from the strict pass earn a `coverage` bonus
  (new weight, default 4), shown in the breakdown. Fielded and wrapped queries skip the
  strict pass, and so do boolean queries: they carry their own logic and are sent as written.
- **Light stemming** in the local matcher: a term matches a word when they are equal or
  share a stem (final vowel stripped, words of five letters or more). Whole-word comparison
  is kept, so `immobilità` still does not match `mobilità`.
- **Elided articles** (`dell`, `nell`, `dall`, `sull`, `all`, `coll`, `quell`) join the
  stopwords: `dell'aria` tokenises to `dell` + `aria`.
- **No IDF.** The measurements do not support it; #539 is updated accordingly.
- JSON output gains `all_terms_results` (the strict count, `null` when the strict pass was
  skipped); `weights` accepts `coverage`.

## Impact

- Affected specs: `ckan-search`
- Affected code: `src/tools/package.ts` (matcher, scoring, `ckan_find_relevant_datasets`)
- Cost: one extra `package_search` call per ranked search — the strict pass — and none
  for boolean or fielded queries. The default pass still runs so `total_results` keeps its
  meaning; when the strict pass already filled the limit it is a `rows=0` count only. See
  `design.md`
- Backwards compatible: inputs unchanged; `coverage` is an optional weight; existing
  breakdown fields keep their meaning
