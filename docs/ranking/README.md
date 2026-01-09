# CKAN Search Ranking: Analysis, Proposals, and Tests

Date: 2026-01-09
Scope: CKAN MCP Server (`ckan_package_search`) against https://www.dati.gov.it/opendata

## Summary of Findings

- CKAN `package_search` on dati.gov.it exposes only a **subset** of Solr parameters.
- Verified as accepted: `defType`, `qf`, `bf`, `boost`, `tie`, `mm`.
- Not accepted on this portal: `pf`, `pf2`, `pf3`, `bq`, `fl`.
- There is **no stemming/lemmatization** for Italian pluralization in the `q` field: `scuola` and `scuole` return different results.
- Ranking changes are most visible for **generic queries**; specific multi-term queries are already strong matches.

## Practical Implications

1) **Ranking control is possible** using `edismax` + `qf` + `tie` + `mm`.
2) **Phrase boosting is not available** via `pf/pf2/pf3` here.
3) **Query expansion** (plural/singular or wildcard) is necessary for Italian morphology.

## Proposed Ranking Profiles

### 1) Balanced (recommended default)

```
# Solr params to pass via CKAN

defType=edismax
qf=title^10 tags^6 notes^2
tie=0.1
mm=2<75%
```

Rationale:
- Prefer title + tags for precision, still allow notes to contribute.
- `mm` removes weak multi-term matches.
- `tie` allows additional fields to contribute to the score.

### 2) Recency-Boosted (optional)

```
# Balanced + recency boost

defType=edismax
qf=title^10 tags^6 notes^2
tie=0.1
mm=2<75%
bf=recip(ms(NOW,metadata_modified),3.16e-11,1,1)
```

Rationale:
- Adds a mild time-decay boost for recently modified datasets.

### 3) Aggressive Title-Heavy (optional)

```
# More title-centric weighting

defType=edismax
qf=title^15 tags^8 notes^1
tie=0.2
mm=2<75%
```

Note: avoid `boost=title:...` because it triggered Solr errors on dati.gov.it.

## Query Expansion (Italian plural/singular)

Because `scuola` and `scuole` behave differently, consider a lightweight expansion:

- OR expansion: `q=(scuola OR scuole)`
- or wildcard: `q=scuol*` (broader, may reduce precision and performance)

## Region + Keyword Strategy

When users include a region name, prefer a filter query over free text:

- Use `fq=organization:regione-<slug>` on dati.gov.it.
- If the filter returns too few results, fallback to text-only search.

See `docs/ranking/regions-dati-gov-it.md` for the region → slug mapping.

## Proposal: `ckan_package_search` Parameters

Add optional parameters (all optional, defaulting to current behavior if omitted):

- `ranking_profile`: `"default" | "balanced" | "recency" | "aggressive"`
- `solr_params`: object for advanced/explicit overrides (whitelisted keys)
  - Allowed keys: `defType`, `qf`, `tie`, `mm`, `bf`, `boost`
- `region`: string (only applied to known portals with curated mapping)

**Suggested default behavior**

- If `ranking_profile` is not provided, use `balanced`.
- If `region` is provided and mapping exists, set `fq=organization:regione-<slug>`.
- If `solr_params` is provided, override the profile params (but keep whitelist).

## Tests

See `docs/ranking/tests.sh` for an automated test set.

The test script compares:
- default
- balanced
- recency
- aggressive

across a small set of queries (5–10). You can extend the query list as needed.

