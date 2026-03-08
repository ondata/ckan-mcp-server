# MCP server per open data: i 10 progetti più rilevanti e i pattern emergenti

**L'ecosistema dei server MCP per open data è giovane ma in rapida espansione**, con oltre 30 progetti attivi su GitHub che coprono CKAN, Socrata, SPARQL/Wikidata, Eurostat, GeoServer e OpenStreetMap. Il progetto più popolare, OpenDataMCP, supera le 140 stelle e ambisce a collegare milioni di dataset aperti a qualsiasi LLM. Il dato più significativo: due governi nazionali — Francia e Stati Uniti (Census Bureau) — hanno già rilasciato server MCP ufficiali, segnando l'ingresso istituzionale in questo spazio. L'analisi rivela un ecosistema dove prevale il "building over talking": i progetti proliferano su GitHub mentre le discussioni su Reddit sono quasi assenti, e nessuna review comparativa esisteva fino ad oggi.

---

## I 10 progetti più rilevanti, ordinati per impatto

### 1. OpenDataMCP/OpenDataMCP — il framework universale

| Campo | Dettaglio |
|-------|-----------|
| **URL** | https://github.com/OpenDataMCP/OpenDataMCP |
| **Stelle** | ~145 ⭐ |
| **Linguaggio** | Python |
| **Stato** | Attivo (70 commit, community Discord) |

Il progetto più ambizioso dell'intero ecosistema. OpenDataMCP adotta un'**architettura modulare a provider**: ogni fonte dati è un modulo Python indipendente con naming convention `{codice_paese}_{organizzazione}.py`. Attualmente focalizzato sui ~12.000 dataset aperti svizzeri, offre una CLI (`uvx odmcp list`, `uvx odmcp setup`) che configura automaticamente Claude Desktop in due click. L'obiettivo dichiarato — "Connect any Open Data to any LLM" — lo posiziona come potenziale standard de facto. Il design a plugin permette contribuzioni comunitarie senza modificare il core, un pattern architetturale che nessun altro progetto ha implementato con questa pulizia.

**Feature distintive**: architettura provider modulare, CLI per setup automatico, community Discord attiva, roadmap per milioni di dataset.

### 2. sib-swiss/sparql-llm — SPARQL potenziato da RAG

| Campo | Dettaglio |
|-------|-----------|
| **URL** | https://github.com/sib-swiss/sparql-llm |
| **Stelle** | ~96 ⭐ |
| **Linguaggio** | Python |
| **Stato** | Molto attivo (429 commit, paper ISWC 2024) |

Il progetto tecnicamente più sofisticato. Sviluppato dallo Swiss Institute of Bioinformatics, combina **tre componenti**: un sistema di chat (expasy.org/chat), un server MCP (chat.expasy.org/mcp) e una libreria pip riusabile (`sparql-llm`). L'innovazione chiave è l'uso di **RAG (Retrieval-Augmented Generation) per la validazione delle query SPARQL**: il sistema estrae automaticamente i vocabolari VoID degli endpoint, genera schemi ShEx per le classi, e valida le query prima dell'esecuzione. Supporta query federate su endpoint biomedici (UniProt, Bgee, OMA, SwissLipids). Ha una **pubblicazione accademica peer-reviewed** a ISWC 2024, caso unico in questa lista.

**Feature distintive**: validazione query via schema VoID, generazione ShEx automatica, RAG per SPARQL, query federate, pubblicazione accademica.

### 3. mahdin75/geoserver-mcp + gis-mcp — il tandem geospaziale OGC

| Campo | Dettaglio |
|-------|-----------|
| **URL** | https://github.com/mahdin75/geoserver-mcp (54 ⭐) e https://github.com/mahdin75/gis-mcp (82 ⭐) |
| **Stelle** | **82 + 54 ⭐** (progetti companion) |
| **Linguaggio** | Python |
| **Stato** | Attivo (42 + commit, sito web dedicato gis-mcp.com) |

L'unico progetto che copre gli standard **OGC WFS/WMS/WCS** attraverso l'interfaccia REST di GeoServer, l'implementazione di riferimento OGC. Il server geoserver-mcp offre gestione workspace e layer, query spaziali con filtri CQL, e generazione mappe configurabili (layer, stili, bbox, formato). Il companion gis-mcp aggiunge operazioni geometriche (intersezione, unione, buffer), trasformazioni CRS, misurazioni accurate e analisi spaziale. Insieme formano lo **stack geospaziale MCP più completo disponibile**, con supporto Docker e un sito web dedicato.

**Feature distintive**: query CQL su dati vettoriali, generazione mappe, operazioni geometriche avanzate, trasformazioni CRS, stack GIS completo.

### 4. ondata/ckan-mcp-server — il connettore universale CKAN

| Campo | Dettaglio |
|-------|-----------|
| **URL** | https://github.com/ondata/ckan-mcp-server |
| **Stelle** | 1 ⭐ (ma 224 commit e npm package) |
| **Linguaggio** | TypeScript |
| **Stato** | Molto attivo (224 commit, 200+ test) |

La stella nascente dell'ecosistema. Creato dal team italiano onData (di Andrea Borruso), questo server si connette a **qualsiasi portale CKAN al mondo** — dati.gov.it, data.gov, data.europa.eu, opendata.swiss e centinaia di altri. L'implementazione è la più ricca tra tutti i progetti CKAN: supporta **sintassi Solr completa** (fuzzy matching, ricerca di prossimità, range, boosting), query SQL sul DataStore, e integra i **punteggi di qualità MQA** (accessibilità, riusabilità, interoperabilità, trovabilità). Sfrutta tutte e tre le primitive MCP — **Tools, Resources con URI template (`ckan://{server}/dataset/{id}`) e Prompt template** — un pattern di design che pochissimi altri progetti implementano completamente. Deployabile su Cloudflare Workers con un endpoint demo pubblico gratuito.

**Feature distintive**: trifecta MCP completa (Tools + Resources + Prompts), Solr syntax, MQA quality scores, deploy su Cloudflare Workers, 200+ test automatizzati.

### 5. emekaokoye/mcp-rdf-explorer — l'esploratore di knowledge graph

| Campo | Dettaglio |
|-------|-----------|
| **URL** | https://github.com/emekaokoye/mcp-rdf-explorer |
| **Stelle** | ~48 ⭐ |
| **Linguaggio** | Python |
| **Stato** | Attivo (13 commit) |

Progetto specializzato nell'esplorazione conversazionale di knowledge graph RDF. La caratteristica più originale è la **modalità duale**: può operare su file RDF/Turtle locali oppure su endpoint SPARQL remoti, con lo stesso set di strumenti. Offre discovery automatica dello schema (classi e proprietà), template SPARQL predefiniti, conversione text-to-SPARQL, e generazione di report Markdown. La funzione **"find relationships"** per un soggetto dato è particolarmente utile per l'esplorazione esplorativa di linked data.

**Feature distintive**: dual mode (locale/remoto), schema discovery automatico, text-to-SPARQL, report Markdown, esplorazione relazioni.

### 6. datagouv/datagouv-mcp — il server MCP governativo ufficiale

| Campo | Dettaglio |
|-------|-----------|
| **URL** | https://github.com/datagouv/datagouv-mcp |
| **Stelle** | ~21 ⭐ (83 commit) |
| **Linguaggio** | Python |
| **Stato** | Molto attivo, ufficiale del governo francese |
| **Endpoint pubblico** | https://mcp.data.gouv.fr/mcp |

**Il primo server MCP ufficiale di un governo nazionale per open data.** Sviluppato dal team di data.gouv.fr, offre un endpoint pubblico hosted che non richiede installazione né autenticazione. Permette di cercare dataset, esplorare organizzazioni, ottenere specifiche OpenAPI dei servizi dati, e accedere a metriche (visite, download). Compatibile con ChatGPT, Claude, Gemini, Cursor, VS Code Copilot e altri. Menzionato su Hacker News e oggetto di un articolo tecnico su Medium. Ha generato almeno tre fork/varianti comunitarie (ricerca aziende, servizi IGN, API tabulari). Rappresenta il **modello di riferimento per qualsiasi governo** che voglia offrire i propri dati via MCP.

**Feature distintive**: endpoint pubblico hosted senza installazione, progetto governativo ufficiale, metriche d'uso dataset, specifiche OpenAPI integrate.

### 7. zzaebok/mcp-wikidata — il ponte verso la conoscenza strutturata

| Campo | Dettaglio |
|-------|-----------|
| **URL** | https://github.com/zzaebok/mcp-wikidata |
| **Stelle** | ~31 ⭐ |
| **Linguaggio** | Python |
| **Stato** | Stabile, listato su multipli registri MCP |

L'implementazione community più popolare per Wikidata, con un design tool pulito: `search_entity`, `search_property`, `get_properties`, `execute_sparql`, `get_label_description`. Installabile via Smithery CLI. Da notare che esiste anche un **server MCP ufficiale Wikimedia** (wd-mcp.wmcloud.org) presentato a WikidataCon 2025, che aggiunge **ricerca semantica vettoriale** tramite il Wikidata Embedding Project — una feature unica che nessuna implementazione community offre. Il server ufficiale randomizza QID/PID nei prompt di sistema per impedire che l'LLM si affidi a identificatori memorizzati, un accorgimento anti-hallucination sofisticato.

**Feature distintive**: tool design minimalista ed efficace; il server ufficiale Wikimedia aggiunge ricerca vettoriale semantica e shuffling anti-hallucination dei QID/PID.

### 8. gvaibhav/TAM-MCP-Server — l'aggregatore multi-sorgente

| Campo | Dettaglio |
|-------|-----------|
| **URL** | https://github.com/gvaibhav/TAM-MCP-Server |
| **Stelle** | ~28 ⭐ |
| **Linguaggio** | TypeScript |
| **Stato** | Attivo |

Approccio radicalmente diverso: invece di un singolo portale, aggrega **8 fonti dati pubbliche** (Alpha Vantage, BLS, Census, FRED, IMF, Nasdaq, OECD, World Bank) in un unico server con **28 tool organizzati su tre livelli** — data access, analysis e business intelligence. Include 15 prompt template professionali per analisi di mercato. Supporta tre trasporti (STDIO, Streamable HTTP, SSE) e notifiche real-time. L'architettura a tier è un pattern originale che separa l'accesso ai dati grezzi dall'analisi, permettendo all'LLM di operare al livello di astrazione appropriato.

**Feature distintive**: architettura a 3 tier (data/analysis/BI), 8 API aggregate, 15 prompt professionali, notifiche real-time.

### 9. lzinga/us-gov-open-data-mcp — il campione di copertura

| Campo | Dettaglio |
|-------|-----------|
| **URL** | https://github.com/lzinga/us-gov-open-data-mcp |
| **Stelle** | ~6 ⭐ |
| **Linguaggio** | TypeScript |
| **Stato** | Attivo (SDK + MCP server) |

Il progetto con la **maggiore copertura API**: **39 API governative e internazionali con 219 tool**. Copre Treasury, FRED, Congress, FDA, CDC, FEC, BLS, USGS, NIH, DOE, EPA e molti altri. Di queste, 21 API non richiedono chiave; le restanti usano chiavi gratuite. Offre caching, retry e rate limiting built-in. Oltre al server MCP, funziona come **SDK TypeScript standalone**, un approccio dual-use che amplia significativamente il bacino d'utenza. La documentazione completa è su lzinga.github.io/us-gov-open-data-mcp.

**Feature distintive**: 219 tool su 39 API, dual-use (MCP server + SDK standalone), caching/retry/rate limiting integrati.

### 10. NERVsystems/osmmcp — OpenStreetMap production-grade in Go

| Campo | Dettaglio |
|-------|-----------|
| **URL** | https://github.com/NERVsystems/osmmcp |
| **Stelle** | ~8 ⭐ |
| **Linguaggio** | Go |
| **Stato** | Molto attivo (126 commit) |

L'implementazione **più matura e production-ready** per OpenStreetMap. Scritto in Go, integra tre API (Nominatim, OSRM, Overpass), con geocoding, routing, analisi di quartiere, ricerca stazioni di ricarica EV, filtraggio elementi OSM per tag/distanza, e **generazione mappe SVG inline**. Il differenziatore tecnico è l'**infrastruttura di produzione**: metriche Prometheus, tracing OpenTelemetry, health check, rate limiting configurabile, caching con TTL, binary pre-compilati per tutte le piattaforme. L'approccio a "composable primitives" permette agli LLM di combinare operazioni base in workflow complessi.

**Feature distintive**: osservabilità (Prometheus, OpenTelemetry), composable primitives, mappe SVG, binary cross-platform, rate limiting granulare.

---

## Menzioni notevoli fuori dalla top 10

| Progetto | Stelle | Focus | Nota |
|----------|--------|-------|------|
| ondics/ckan-mcp-server | 11 ⭐ | CKAN (Python) | Alternativa Python al server onData |
| srobbin/opengov-mcp-server | 10 ⭐ | Socrata/US Gov | Unico server Socrata, su npm |
| sbl-sdsc/mcp-proto-okn | 2 ⭐ | Knowledge graph scientifici | 161 commit, NSF-funded |
| ano-kuhanathan/eurostat-mcp | 0 ⭐ | Eurostat | Early stage (1 commit), Python |
| uscensusbureau/us-census-bureau-data-api-mcp | N/A | US Census (ufficiale) | Server MCP ufficiale Census Bureau |
| isakskogstad/OECD-MCP | 0 ⭐ | OECD (5.000+ dataset) | 9 tool + 7 resource + 7 prompt |
| malkreide/zurich-opendata-mcp | N/A | Zurigo (900+ dataset) | Include SPARQL per linked data |
| Sofias-ai/mcp-ine | N/A | INE Spagna | 109+ operazioni statistiche |
| openascot/ckan-mcp | N/A | CKAN (600+ portali) | Preset per 600+ portali globali |

---

## I 7 pattern architetturali più interessanti

### Il connettore universale con URL configurabile
La scelta di rendere l'URL del portale un parametro di configurazione (tipicamente via variabile d'ambiente) trasforma un singolo server in un connettore per centinaia di portali. Lo implementano ondata/ckan-mcp-server (qualsiasi CKAN), srobbin/opengov-mcp-server (qualsiasi Socrata), e ekzhu/mcp-server-sparql (qualsiasi endpoint SPARQL). È il pattern più semplice ma più potente: **una singola installazione copre un'intera famiglia di portali**.

### La trifecta MCP: Tools + Resources + Prompts
Pochissimi progetti sfruttano tutte e tre le primitive del protocollo MCP. ondata/ckan-mcp-server è l'esempio più completo: i **Tools** eseguono operazioni (ricerca, query SQL), le **Resources con URI template** (`ckan://{server}/dataset/{id}`) offrono accesso diretto ai dati, e i **Prompt template** (`ckan-search-by-theme`, `ckan-analyze-dataset`) guidano l'utente in workflow predefiniti. Questo design a tre livelli massimizza sia la flessibilità programmatica sia l'usabilità conversazionale.

### RAG per validazione e generazione di query
sib-swiss/sparql-llm ha introdotto un pattern innovativo: usare **Retrieval-Augmented Generation non per rispondere a domande, ma per generare e validare query SPARQL**. Il sistema recupera automaticamente vocabolari VoID e schemi ShEx dall'endpoint target, poi li usa come contesto per guidare l'LLM nella costruzione di query sintatticamente e semanticamente corrette. Questo approccio è generalizzabile a qualsiasi linguaggio di query strutturato (SQL, SoQL, CQL).

### Architettura a tier per separare accesso e analisi
TAM-MCP-Server organizza i suoi 28 tool su **tre livelli**: data access (query grezze), analysis (aggregazioni e confronti), e business intelligence (insight e raccomandazioni). L'LLM può operare al livello di astrazione appropriato per la domanda dell'utente, evitando sia risposte troppo grezze sia over-interpretation dei dati. È un pattern particolarmente adatto a server multi-sorgente.

### Anti-hallucination by design
Diversi progetti implementano meccanismi espliciti contro le allucinazioni. Il server MCP ufficiale Wikidata **randomizza l'ordine dei QID/PID** per impedire che l'LLM si affidi a identificatori memorizzati durante il training. ondata/ckan-mcp-server integra i **punteggi MQA** per segnalare la qualità dei dataset. L'iniziativa europea wikimcp.eu posiziona esplicitamente i server MCP open data come strumento anti-hallucination: "grounding" delle risposte AI su dati verificati e istituzionali.

### Cloud-native deployment su edge
Almeno quattro progetti (ondata/ckan-mcp-server, Toronto-inc/toronto-mcp, QuentinCody/wikidata-sparql-mcp-server, datagouv/datagouv-mcp) offrono **deploy su Cloudflare Workers o endpoint hosted pubblici**. Questo elimina completamente la barriera dell'installazione locale: l'utente aggiunge semplicemente un URL alla configurazione del proprio client MCP. Il pattern "endpoint pubblico, zero installazione" è probabilmente quello che guiderà l'adozione di massa.

### Dual-use: server MCP + SDK/libreria standalone
lzinga/us-gov-open-data-mcp e sib-swiss/sparql-llm offrono sia un server MCP sia una libreria riusabile indipendente dal protocollo. Questo **dual-use design** amplia il bacino d'utenza ben oltre gli utenti MCP, garantendo che il lavoro sull'integrazione con le API non vada perso se il protocollo dovesse evolversi o essere sostituito.

---

## Lo stato dell'ecosistema e cosa manca

L'ecosistema è in fase di costruzione attiva, con la maggior parte dei progetti creati tra fine 2025 e inizio 2026. Le discussioni su Reddit sono **completamente assenti** — nessun risultato su r/LocalLLaMA, r/opendata o r/MachineLearning. Hacker News ha ospitato un singolo post su datagouv-mcp (2 punti, zero commenti). L'attività comunitaria si concentra su GitHub Issues/PRs e su directory MCP specializzate (Glama.ai, PulseMCP, LobeHub). Un articolo rilevante su Dev.to descrive la costruzione di 13 server MCP per dati governativi US (github.com/martc03/gov-mcp-servers).

Le **lacune più evidenti** nell'ecosistema attuale sono: un server MCP maturo per **Eurostat** (esiste solo un prototipo con 1 commit), un server per **OGC API Features/Records** (il nuovo standard che sostituisce WFS, distinto da GeoServer), e soprattutto un server per **data.europa.eu**, il portale europeo che aggrega i dati di tutti i paesi EU. L'iniziativa wikimcp.eu ha identificato questo gap ma è ancora in fase di reclutamento volontari. Per chi volesse contribuire, queste tre aree rappresentano le opportunità con il maggiore impatto potenziale.