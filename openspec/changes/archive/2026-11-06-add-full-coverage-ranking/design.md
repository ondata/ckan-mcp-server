# Design: full-coverage ranking

## Decision

Fetch candidates with `mm=100%` first, fill from the default search, give the strict
candidates a `coverage` bonus. Stem lightly in the local matcher. Do not add IDF.

## Alternatives measured (2026-09-06, real candidate sets from dati.gov.it)

| option | Lecce case | verdict |
|---|---|---|
| IDF over the candidate set (the issue's proposal) | right dataset drops out of the top 3 | rejected: `lecce` is rarer than `comune` in that set and the wrong datasets carry it in every field |
| stemming alone | right dataset first, margin 0.6 | necessary, not sufficient — cannot help when the dataset is not in the window |
| larger window (rows=100) | no Milan dataset in the top 100 either | rejected: the default `mm` makes the fourth term optional, more rows do not change that |
| `mm=100%` strict pass + fill | right dataset first, margin ≥ 2; Milan reports first | chosen |

## Cost

Before: one `package_search` per ranked search. After: two — the strict pass and the
default pass. The default pass keeps `total_results` honest (the catalog-wide match, as
before); when the strict pass already filled the limit it is sent with `rows=0`, a
count-only request. Boolean and fielded queries make one call, as before. Both passes go
through the read-through cache (300 s), so a repeated query costs nothing extra.

Measured on Workers: a boolean query's first call to a new portal 0.58 s, the second
0.11 s; the extra count-only call is in the same order as the second.

## Risks and mitigations

- **A portal rejects `mm`.** It is on CKAN's `VALID_SOLR_PARAMETERS` and worked on every
  portal tried (dati.gov.it, Milano, Toronto, Zurigo, Messina), but an old or customised
  CKAN could 400 it. The strict pass is wrapped: a failure falls back to the default pass
  alone and reports `all_terms_results: null`. The tool never fails because of the strict
  pass.
- **A term absent from the catalog** makes the strict pass return 0. The fill covers it:
  the caller gets what the default search gives, with no bonus, which is the honest answer.
- **Stemming false positives.** One final vowel on words of five letters or more, whole
  words only. `porta`/`porto` would collide; measured on the smoke queries no ranking
  changed for the worse, and the gate pins the cases that matter.
- **Boolean queries under `mm=100%`** would require the `OR` token itself. They skip the
  strict pass.
