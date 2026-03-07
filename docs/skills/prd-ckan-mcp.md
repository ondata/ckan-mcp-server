# PRD - Skill: ckan-mcp

Notes and requirements for building the `ckan-mcp` skill.

## Goal

Permettere a qualsiasi utente — senza conoscere CKAN, Solr o le API — di esplorare portali open data CKAN in linguaggio naturale, usando i tool del server MCP `ckan-mcp-server`.

La skill traduce domande generiche ("quali dati sull'inquinamento in Canada?") in sequenze ottimali di chiamate MCP, guida l'utente quando servono scelte (quale portale? quale dataset?) e presenta i risultati in modo chiaro.

**Tagline del progetto**: *"Turn any (CKAN) open data portal into a conversation."*

## Target users

Chiunque voglia trovare o esplorare dati aperti, senza prerequisiti tecnici:
- Giornalisti che cercano dati per verificare una storia
- Ricercatori che esplorano dataset pubblici
- Funzionari pubblici che vogliono vedere cosa pubblica la propria amministrazione
- Sviluppatori che costruiscono pipeline dati
- Cittadini curiosi

## Use cases

1. **Ricerca generica per paese**: "Quali dati sull'inquinamento in Canada?" → scopri portali CKAN del paese, cerca nei dataset
2. **Ricerca su portale specifico**: "Cerca dati sulla mobilità urbana su dati.gov.it" → ricerca diretta
3. **Esplorazione portale europeo**: "Trova dataset ambientali per Italia e Francia su data.europa.eu" → REST API europa
4. **Approfondimento dataset**: "Mostrami i dettagli di questo dataset e i suoi file scaricabili"
5. **Query su dati tabulari**: "Interroga i dati sulle ordinanze di Messina filtrando per tipo lavori"
6. **Esplorazione organizzazioni/temi**: "Quali organizzazioni pubblicano più dati sanitari su dati.gov.it?"
7. **Analisi qualità**: "Qual è la qualità MQA di questo dataset su dati.gov.it?"

## Tools available (MCP server)

Tutti i tool del server `ckan-mcp-server`:

**Ricerca e discovery**
- `ckan_package_search` — ricerca dataset con query Solr
- `ckan_find_relevant_datasets` — ranking per rilevanza
- `ckan_package_show` — dettaglio completo di un dataset
- `ckan_tag_list` — lista tag con conteggi

**Organizzazioni e gruppi**
- `ckan_organization_list` — lista organizzazioni
- `ckan_organization_show` — dettaglio organizzazione
- `ckan_organization_search` — cerca organizzazioni per nome
- `ckan_group_list` — lista gruppi tematici
- `ckan_group_show` — dettaglio gruppo
- `ckan_group_search` — cerca gruppi per nome

**DataStore (dati tabulari)**
- `ckan_datastore_search` — query su risorse tabulari
- `ckan_datastore_search_sql` — query SQL su DataStore

**Qualità metadati**
- `ckan_get_mqa_quality` — score MQA per dataset su dati.gov.it
- `ckan_get_mqa_quality_details` — dettaglio flag MQA

**Scoperta portali**
- `ckan_find_portals` — scopre portali CKAN nel mondo per paese/lingua/tema (registry ~950 portali)

**Analisi catalogo**
- `ckan_analyze_datasets` — cerca dataset e ispeziona schemi DataStore
- `ckan_catalog_stats` — overview statistica di un portale

**SPARQL**
- `sparql_query` — query SELECT su endpoint SPARQL pubblici

**Utility**
- `ckan_status_show` — verifica stato del server CKAN

**MCP Resource Templates** (accesso diretto via URI `ckan://`):
- `ckan://{server}/dataset/{id}`
- `ckan://{server}/resource/{id}`
- `ckan://{server}/organization/{name}`
- `ckan://{server}/group/{name}/datasets`
- `ckan://{server}/tag/{name}/datasets`
- `ckan://{server}/format/{format}/datasets`

## Key behaviors

1. **Linguaggio naturale → tool call**: tradurre qualsiasi domanda nella sequenza corretta di tool MCP, senza esporre dettagli tecnici all'utente
2. **Keyword multilingue**: usare keyword nella lingua dell'utente + equivalente inglese collegati con **OR esplicito** (`q=inquinamento OR pollution`). CKAN usa AND implicito tra i termini: `q=inquinamento pollution` cerca documenti che contengono entrambe le parole (risultati: 14), mentre `q=inquinamento OR pollution` allarga la copertura (risultati: 253)
3. **Scoperta portale prima della ricerca**: se l'utente non specifica un portale, usare `ckan_find_portals` per scoprirlo
4. **Gestione multipli portali**: se `ckan_find_portals` restituisce >1 risultato, mostrare la lista e chiedere dove cercare
5. **Fallback portale non trovato**: se `ckan_find_portals` restituisce 0, comunicare l'impossibilità e suggerire alternativa (es. portale europeo)
6. **Portale europeo**: per domande su dati UE o multi-paese europei, usare la REST API `https://data.europa.eu/api/hub/search/search` (non SPARQL come default)
7. **Raffinamento risultati**: se i risultati sono troppi (es. >100), guidare l'utente a raffinare per tema, organizzazione, formato o data
8. **DataStore**: verificare sempre `datastore_active: true` prima di proporre query tabulari
9. **Non inventare**: se un tool non restituisce dati, comunicarlo chiaramente senza supplementare con dati altrove
10. **Verifica portale con `ckan_status_show` prima di cercare**: il registry di `ckan_find_portals` può essere obsoleto — un portale potrebbe aver cambiato tecnologia, URL o non rispondere più. Dopo aver ottenuto un URL dal registry, chiamare sempre `ckan_status_show` per verificare che sia ancora un portale CKAN funzionante. Se fallisce, scartarlo e provare il successivo dalla lista
11. **Francia — nessun portale CKAN utile**: `data.gouv.fr` (il portale nazionale francese) usa uData, non CKAN, quindi non appare nel registry. I portali francesi nel registry sono piccoli e spesso non funzionanti via API. Per dati francesi, suggerire il portale europeo `data.europa.eu`
12. **Filtri per data — mai `metadata_modified` su aggregatori**: su portali aggregatori (es. dati.gov.it), `metadata_modified` è aggiornato ad ogni re-harvesting → rumore puro. Distinguere l'intento dell'utente:

    | Domanda utente | Campo da usare | Note |
    |---|---|---|
    | "dataset pubblicati nel 2024" | `issued` | Data di rilascio del publisher. ~86% dei dataset su dati.gov.it ce l'hanno. 0 risultati = nessun dataset pubblicato in quel periodo |
    | "dataset apparsi sul portale di recente" | `metadata_created` | Prima comparsa sul portale (harvesting) |
    | "dataset recenti" (intento ambiguo) | `content_recent: true` | Parametro smart: usa `issued` con fallback automatico a `metadata_created` |

    - **Test confermati** su dati.gov.it con `q=ambiente`, ultimi 60 giorni:
      - `metadata_modified` → 10.035 (noise harvesting)
      - `issued` → 0 (nessun contenuto *pubblicato* negli ultimi 60gg — corretto, non un bug)
      - `metadata_created` → 1.397 (apparsi sul portale di recente)
      - `content_recent: true` → 470 (issued + fallback metadata_created)
    - Per domande ambigue usare sempre `content_recent: true` con `content_recent_days`
    - Avvertire l'utente che `issued` esclude il ~14% di dataset che non hanno il campo popolato

## Examples of trigger phrases

- "Quali dati sull'inquinamento in Canada?"
- "Cerca dataset sulla mobilità urbana su dati.gov.it"
- "Trova dati ambientali per Italia e Spagna sul portale europeo"
- "Mostrami i dataset dell'organizzazione Regione Toscana"
- "Quanti dataset ci sono per tema su dati.gov.it?"
- "Interroga i dati sulle ordinanze di Messina"
- "Trova portali CKAN in Francia con almeno 1000 dataset"
- "Qual è la qualità di questo dataset?"
- "Cerca dataset CSV aggiornati nel 2025 su dati.gov.it"

## Open questions

## Notes

La skill deve guidare l'utente nel risolvere le questioni legate a una domanda generica.

Ad esempio, la prima domanda potrebbe essere: "Quali dati sull'inquinamento in Canada?"

A questo punto la skill utilizzerebbe il tool `find_portals`, cercherebbe il portale del Canada, e se esiste un portale canadese basato su CKAN, userebbe il tool appropriato per cercare "inquinamento" in quel portale.

Se in Canada ci fossero più portali, l'utente dovrebbe sapere quali sono e gli si dovrebbe chiedere in quale cercare.

Se non c'è nessun portale nell'elenco di `find_portals`, si comunica all'utente che non è possibile fare questa ricerca.

Un'altra modalità da intercettare tramite la skill è quella delle richieste legate a dati da cercare nel portale Open Data dell'Europa. In questo caso la skill dovrebbe fare in modo di utilizzare lo strumento `sparql_query` e cercare nell'endpoint SPARQL del portale Open Data europeo, che è questo: https://data.europa.eu/sparql

## Simulation findings

### Caso 1 — Query generica per paese

**Flow**: `find_portals(country)` → presentare lista → `ckan_package_search(portal, keyword)`

Osservazioni:
- Canada ha 10 portali → la skill deve sempre mostrare la lista e chiedere all'utente quale usare (o suggerire il principale per numero di dataset)
- La keyword va tradotta in inglese (l'utente scrive "inquinamento", il tool cerca "pollution")
- Il portale principale `open.canada.ca` ha restituito 487 risultati — bisogna guidare l'utente a raffinare la ricerca

Comportamento atteso della skill:
1. Tradurre paese e keyword in inglese
2. Chiamare `find_portals`
3. Se 0 portali → comunicare impossibilità di fare la ricerca
4. Se 1 portale → procedere direttamente
5. Se >1 portale → mostrare lista con nome, URL, numero dataset e chiedere dove cercare

### Caso 2 — Portale Open Data Europa

#### Approccio preferito: REST API

**Flow**: `Bash curl` verso `https://data.europa.eu/api/hub/search/search`

Parametri chiave:
- `q`: keyword di ricerca in inglese
- `filters=dataset`: limita ai dataset
- `facets`: JSON con `country` (id a 2 lettere: `it`, `fr`, `es`) e `categories` (es. `ENVI`)
- `limit`: numero risultati

**Esempio:**

```bash
curl -s "https://data.europa.eu/api/hub/search/search?q=pollution&filters=dataset&facets=%7B%22country%22%3A%5B%22it%22%2C%22fr%22%2C%22es%22%5D%2C%22categories%22%3A%5B%22ENVI%22%5D%7D&limit=10"
```

Risultato test: **1061 dataset** per ITA/FRA/ESP con q=pollution+ENVI.

**Regole per la skill:**
- Tradurre keyword e paesi in inglese
- Usare `q=KEYWORD` (ricerca full-text, semplice)
- Filtrare con `facets={"country":[...],"categories":[...]}`
- Country id = codice ISO 2 lettere minuscolo (`it`, `fr`, `es`, `de`, ...)
- Categories id = codice tema (`ENVI`, `HEAL`, `TRAN`, `ECON`, ...)
- Risposta: `result.count` per totale, `result.results[]` per i dataset (campi: `title.en`, `publisher.name`, `country.label`)

**Confronto REST API vs SPARQL:**

| | SPARQL | REST API |
|---|---|---|
| Risultati (stesso test) | 92 | **1061** |
| Complessità query | Alta | Bassa |
| Filtro paese | URI completo | ID 2 lettere |
| Velocità | Variabile (rischio timeout) | Veloce |
| Uso consigliato | Query relazionali/strutturate | Ricerche generiche |

#### Approccio alternativo: SPARQL (solo per query strutturate)

**Flow**: `sparql_query(https://data.europa.eu/sparql, query SPARQL)`

Osservazioni:
- `CONTAINS` su `dct:title` senza anchor → timeout
- `CONTAINS` su `dcat:keyword` (stringhe corte) con anchor su `dcat:theme` → veloce
- Il pattern vincente è: `dcat:theme` + `dct:spatial IN (paesi)` + `CONTAINS(keyword, term OR ...)`
- Filtrare sempre `LANG(?title) = "" || LANG(?title) = "en"` per risultati leggibili

**Pattern SPARQL confermato:**

```sparql
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT DISTINCT ?datasetURI ?datasetTitle ?publisher
WHERE {
  ?datasetURI a dcat:Dataset ;
    dct:publisher/rdfs:label|dct:publisher/skos:prefLabel ?publisher ;
    dcat:theme <http://publications.europa.eu/resource/authority/data-theme/ENVI> ;
    dcat:keyword ?keyword ;
    dct:title ?datasetTitle ;
    dct:spatial ?spatial .
  FILTER(?spatial IN (
    <http://publications.europa.eu/resource/authority/country/ITA>,
    <http://publications.europa.eu/resource/authority/country/FRA>,
    <http://publications.europa.eu/resource/authority/country/ESP>
  ))
  FILTER(
    CONTAINS(LCASE(STR(?keyword)), "pollut") ||
    CONTAINS(LCASE(STR(?keyword)), "contaminat") ||
    CONTAINS(LCASE(STR(?keyword)), "emission")
  )
  FILTER(LANG(?datasetTitle) = "" || LANG(?datasetTitle) = "en")
  FILTER(LANG(?publisher) = "" || LANG(?publisher) = "en")
}
LIMIT 20
```

Risultato test: 92 dataset per ITA/FRA/ESP con sinonimi "pollut|contaminat|emission".

**Regole per la skill:**
- Tradurre keyword utente in inglese
- Generare 3 sinonimi/varianti (es. "pollut", "contaminat", "emission")
- Usarli in OR nel FILTER su `dcat:keyword`
- Mappare il topic al `data-theme` URI corretto (es. ENVI per ambiente)
- Mappare paesi a URI `http://publications.europa.eu/resource/authority/country/XXX`

**data-theme URI utili:**
- Ambiente: `http://publications.europa.eu/resource/authority/data-theme/ENVI`
- Salute: `http://publications.europa.eu/resource/authority/data-theme/HEAL`
- Trasporti: `http://publications.europa.eu/resource/authority/data-theme/TRAN`
- Economia: `http://publications.europa.eu/resource/authority/data-theme/ECON`

---

## Approfondimento: API data.europa.eu per cittadino europeo

Riferimento spec: `https://data.europa.eu/api/hub/search/openapi.yaml`

### Endpoint disponibili (read-only rilevanti)

| Endpoint | Descrizione |
|---|---|
| `GET /search` | Ricerca full-text con facets (principale) |
| `GET /catalogues` | Lista ID di tutti i cataloghi |
| `GET /catalogues/{id}` | Dettaglio di un catalogo specifico |
| `GET /ckan/package_search` | Ricerca CKAN-style con `q` e `fq` Solr |
| `GET /ckan/package_show` | Dettaglio dataset per ID |

### Strategia ottimale per ricerca per paese europeo

**Scoperta chiave**: usare keyword **lingua nativa + inglese** massimizza i risultati:
- `q=inquinamento` → 268 risultati (IT)
- `q=pollution` → 290 risultati (IT)
- `q=inquinamento pollution` → **428 risultati** (IT) ← usa questo

**Flow raccomandato:**

```bash
# 1. Ricerca principale
curl -G "https://data.europa.eu/api/hub/search/search" \
  --data-urlencode "q=KEYWORD_NATIVA KEYWORD_EN" \
  --data-urlencode 'filters=dataset' \
  --data-urlencode 'facets={"country":["CODICE_PAESE"],"categories":["TEMA"]}' \
  --data-urlencode "limit=10"

# 2. Dettaglio dataset (se necessario)
curl "https://data.europa.eu/api/hub/search/ckan/package_show?id=UUID"
```

**Filtri `facets` disponibili:**
- `country`: codice ISO 2 lettere minuscolo (`it`, `fr`, `de`, `es`, `pt`, ...)
- `categories`: tema DCAT (`ENVI`, `HEAL`, `TRAN`, `ECON`, `AGRI`, `JUST`, ...)
- `catalog`: ID catalogo specifico (es. `dati-gov-it`, `rndt`)
- `format`: formato file (`CSV`, `JSON`, `XML`, ...)
- `is_hvd`: `true` per High Value Datasets

**Cataloghi italiani su data.europa.eu:** solo 2 — `dati-gov-it` e `rndt`

**Endpoint CKAN alternativo** (solo single-country):
```bash
curl -G "https://data.europa.eu/api/hub/search/ckan/package_search" \
  --data-urlencode "q=pollution" \
  --data-urlencode "fq=country:it" \
  --data-urlencode "rows=10"
```
- Vantaggio: supporta `fq` Solr nativo
- Limite: OR multi-paese non funziona (`fq=country:(it OR fr)` → 0 risultati)

### Confronto finale approcci per portale europeo

| | REST `/search` | CKAN `/ckan/package_search` | SPARQL |
|---|---|---|---|
| Multi-paese | ✅ `facets` | ❌ solo singolo | ✅ `IN (...)` |
| Risultati (ITA pollution) | 290 | 290 | 92 |
| Keyword multilingue | ✅ `q=word1 word2` | ✅ `q=word1 word2` | ❌ manuale |
| Dettaglio dataset | via `package_show` | via `package_show` | via URI |
| Uso consigliato | **default** | single-country + fq avanzato | query relazionali |

