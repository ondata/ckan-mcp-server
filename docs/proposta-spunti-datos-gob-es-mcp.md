# Proposta tecnica: spunti da datos-gob-es-mcp

Documento di sintesi con priorita ed effort per integrare nel progetto `ckan-mcp-server` alcuni spunti utili osservati nel repo `datos-gob-es-mcp`.

## Obiettivo
Portare nel server CKAN un sottoinsieme di funzionalita "ad alto impatto":
- migliori UX per l'utente MCP (prompt guidati, risorse tematiche)
- miglior throughput (fetch parallelo)
- migliore affidabilita operativa (retry/backoff, rate limiting)
- feature data-friendly (preview dati con statistiche)

## Risultati

### Prompt MCP guidati (completato)
**Cosa**: introdurre prompt MCP riutilizzabili per flussi comuni (es. ricerca per tema/organizzazione/formato, dataset recenti, analisi dataset).
**Valore**: aumenta la qualita delle richieste e riduce errori di uso delle tool.
**Riferimento**: `datos-gob-es-mcp/prompts/*`.
**Impatto**:
- aggiungere cartella `src/prompts/` con generatori di prompt
- registrazione prompt nel server MCP
- aggiornare README con esempi
**Rischi**: minimi (solo documentazione/UX).

## Proposte prioritarie

### 1) Resource template aggiuntivi (alta priorita, effort: **S/M**)
**Cosa**: aggiungere risorse MCP per accesso diretto a dataset filtrati da tag/group/format/keyword.
**Valore**: facilita exploration e discovery senza chiamare tool complesse.
**Riferimento**: `@mcp.resource("theme://{id}")`, `publisher://`, `format://`, `keyword://`.
**Impatto**:
- nuove risorse in `src/resources/` con mapping alle chiamate CKAN (package_search con filtri)
- aggiornare README e docs con nuovi URI
**Rischi**: medi (serve definire mappature CKAN coerenti per tag/group/format).

### 2) HTTP resiliente: retry + rate limiting + pool (alta priorita, effort: **M**)
**Cosa**: introdurre client HTTP con retry/backoff, rate limiting per host e pool riusabile.
**Valore**: stabilita su portali CKAN lenti o con limiti.
**Riferimento**: `datos-gob-es-mcp/core/http.py`, `core/ratelimit.py`, `core/config.py`.
**Impatto**:
- wrapper `makeCkanRequest` con retry/backoff
- rate limiter per server_url
- config via env (max retries, delay, RPS)
**Rischi**: medi (potenziali cambiamenti comportamentali in caso di errori).

### 3) Fetch parallelo per paginazione (media priorita, effort: **M**)
**Cosa**: opzione `fetch_all=true` per scaricare piu pagine in parallelo fino a un max.
**Valore**: velocizza il recupero di grandi cataloghi.
**Riferimento**: `_fetch_all_pages` in `datos-gob-es-mcp/server.py`.
**Impatto**:
- estendere `ckan_package_search` e `ckan_tag_list` con `fetch_all`
- limite max risultati e numero di pagine
**Rischi**: moderati (carico sui portali, da limitare con rate limit).

### 4) Data preview + statistiche colonne (media priorita, effort: **M/L**)
**Cosa**: preview dati per risorse CSV/JSON/TSV con righe campione e statistiche (null rate, unique, min/max).
**Valore**: aiuta l'utente a capire la struttura senza scaricare tutto.
**Riferimento**: `_parse_csv_preview`, `_calculate_column_stats` in `datos-gob-es-mcp/server.py`.
**Impatto**:
- nuova tool opzionale `ckan_resource_preview` oppure flag su `ckan_resource_show`
- limiti dimensione/timeout
**Rischi**: medi (download di risorse, vari formati, tempo di risposta).

## Proposte secondarie

### 5) Cache metadati (bassa priorita, effort: **M**)
**Cosa**: cache TTL su lista org/group/tag per ridurre chiamate ripetute.
**Valore**: performance e minor load sui portali.
**Riferimento**: `MetadataCache` in `datos-gob-es-mcp/server.py`.

### 6) Metriche d'uso locali (bassa priorita, effort: **S/M**)
**Cosa**: contatori di tool, dataset piu accessi, query recenti.
**Valore**: telemetria minimale per capire pattern di uso (locale).
**Riferimento**: `UsageMetrics` in `datos-gob-es-mcp/server.py`.

## Raccomandazione di roadmap
1. Resource template (1-2 giorni)
2. Retry/rate limiting/pool HTTP (2-3 giorni)
3. Fetch parallelo (1-2 giorni, con limiti)
4. Preview dati (3-5 giorni, con analisi e parsing robusto)

## Note di implementazione
- Tutte le nuove opzioni dovrebbero essere opzionali e disabilitabili via env.
- Introdurre limiti conservativi (size, timeout, pagine max).
- Documentare bene in README e `docs/`.
