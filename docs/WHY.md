# Perché CKAN MCP Server? 🚀

Hai mai provato a cercare dati aperti e ti sei perso tra interfacce web complicate? Clicca qui, filtra là, cambia pagina, torna indietro, rifiltra... frustrante, vero?

**C'è un modo migliore**: chiedere quello che vuoi, in linguaggio naturale, e ottenere risposte precise. Come una conversazione con un amico che conosce perfettamente tutti i cataloghi dati aperti.

## Come funziona (in breve)

Questo strumento si integra con **la tua AI preferita** e ti permette di interrogare **qualsiasi portale CKAN** (dati.gov.it, data.gov.uk, data.gov, ecc.) usando domande normali.

Impari una volta, usi ovunque. 🌍

---

## Esempi pratici (dal più semplice al più potente)

### 🎯 Livello 1: la ricerca semplice

**Tu chiedi**: "Ci sono dataset sulla mobilità su dati.gov.it?"

**Risultato**: Sì. 1.758 dataset (as of 1 febbraio 2026)!

> Nota: i numeri variano nel tempo perché i cataloghi si aggiornano continuamente.

Invece di navigare pagine e pagine del catalogo, ottieni tutto in un colpo. Facile!

**Tool usato**: `ckan_package_search`

---

### 🔍 Livello 2: affina la ricerca

**Tu chiedi**: "Voglio solo dataset che hanno 'bike' o 'bici' nel titolo"

**La query usata**:

```
title:bike OR title:bici*
```

**Risultato**: 43 dataset mirati (invece di 1.758!) (as of 1 febbraio 2026).

Il simbolo `*` è un jolly (wildcard) che trova anche "bicicletta", "biciclette", ecc. Vedi? Già molto più preciso!

**Bonus**: "Mostrami i dettagli del primo dataset"

Ottieni:
- Titolo completo
- Descrizione
- Organizzazione che l'ha pubblicato
- Risorse disponibili (CSV, JSON, ecc.)
- Licenza
- Date di creazione e aggiornamento
- Link diretto

**Tool usati**: `ckan_package_search` + `ckan_package_show`

---

### 📊 Livello 3: analisi esplorativa

**Tu chiedi**: "Quali organizzazioni hanno creato più dataset negli ultimi 6 mesi su dati.gov.it?"

**Il sistema interroga** il catalogo con filtri temporali e aggregazioni.

**Query usata**:

```
q: *:*
fq: metadata_created:[NOW-6MONTHS TO *]
facet_field: ["organization"]
```

**Risultato**: 40.072 dataset creati negli ultimi 6 mesi, con la classifica delle top 50 organizzazioni (as of 1 febbraio 2026)!

**Top 3**:
1. Regione Toscana: 12.602 dataset
2. Regione Veneto: 6.555 dataset
3. Regione Lombardia: 3.304 dataset

> Nota: i numeri cambiano nel tempo. Inoltre puoi usare `metadata_created` (creazione record), `modified` o `issued` (se presenti) e ottenere risultati diversi.

Perfetto per capire chi è più attivo nell'open data, senza scaricare nulla!

**Tool usato**: `ckan_package_search` (con faceting per aggregazioni)

---

### 🎯 Livello 4: query mirate (filtri multipli)

**Tu chiedi**: "Dataset su appalti o contratti pubblicati negli ultimi 3 mesi su dati.gov.it"

**Filtri combinati**:
- Ricerca nel titolo: `title:appalti OR title:contratti`
- Filtro temporale: ultimi 3 mesi (es. `metadata_created:[NOW-3MONTHS TO *]`)

> Nota: se usi `modified` o `issued` al posto di `metadata_created`, il conteggio può cambiare.

**Risultato**: 32 dataset trovati (as of 1 febbraio 2026).

Esempio di dataset (uno dei risultati possibili):
- **Titolo**: "COMUNE MONZA Appalti e affidamenti"
- **Organizzazione**: Regione Lombardia
- **Ultimo aggiornamento**: 2026-01-31
- **Formati**: CSV, JSON, RDF, TSV, XML...

Boom! 💥 Dati freschi sulla trasparenza degli appalti pubblici.

**Bonus**: "Quanti dati pubblica in totale il Comune di Bologna su dati.gov.it?"

Ottieni tutti i dataset pubblicati da quell'organizzazione, con statistiche complete.

**Tool usati**: `ckan_package_search` (filtri multipli) + `ckan_organization_show`

---

### 🌍 Livello 5: stesso approccio, portale diverso

**Tu chiedi**: "Stessa ricerca su bike, ma sul portale del Regno Unito (data.gov.uk)"

**La query usata**:

```
title:bike OR title:cycling
```

**Risultato**: 366 dataset (as of 1 febbraio 2026)!

**La parte magica**: impari a usare questo strumento una volta, poi funziona su **qualsiasi portale CKAN del mondo**. Italia, USA, UK, Canada, EU... stesso metodo, dati diversi!

**Tool usato**: `ckan_package_search` (su server diverso)

---

### 💎 Livello 6: interrogare direttamente i dati (datastore)

Finora abbiamo visto solo **metadati** (titoli, descrizioni, organizzazioni). Ma alcuni portali CKAN hanno il **DataStore** attivo, che ti permette di interrogare direttamente i dati dentro i CSV!

#### Esempio reale: ordinanze viabili del Comune di Messina (flusso a step)

**Server**: `dati.comune.messina.it`

**Step 1 - Trova il dataset giusto**

**Tu chiedi**: "Cerca le ordinanze viabili su dati.comune.messina.it"

**Risultato**: dataset "Ordinanze viabili" (as of 1 febbraio 2026), con una risorsa CSV e **DataStore attivo**.

**Tool usato**: `ckan_package_search`

---

**Step 2 - Verifica struttura e campi**

**Tu chiedi**: "Fammi vedere le prime 5 righe"

**Risultato**: confermi che esistono campi come `tipo`, `data_pubblicazione`, `numero`, `aree`, `sintesi`.

**Tool usato**: `ckan_datastore_search`

---

**Step 3 - Filtra solo le ordinanze di tipo specifico**

**Tu chiedi**: "Quante sono le ordinanze di tipo 'divieto_transito'"

**Filtro applicato**:

```
filters: { "tipo": "divieto_transito" }
```

**Risultato**: 259 ordinanze (su 2.041 totali) (as of 1 febbraio 2026)!

**Esempio di risultato**:

| numero | data_pubblicazione | tipo | sintesi |
|--------|-------------------|------|---------|
| 153 | 2026-01-30 | divieto_transito | Viale S. Martino, limitazione 30 km/h |

**Tool usato**: `ckan_datastore_search`

---

**Nota importante**: il DataStore è disponibile principalmente sui **portali locali** (comuni, regioni), mentre il portale nazionale `dati.gov.it` raccoglie i metadati ma non attiva il DataStore. Se vuoi interrogare direttamente i dati, cerca dataset sui portali locali!

---

## 🦸 Altri super poteri

Hai visto i tool principali in azione. Ma ce ne sono altri che ti danno poteri extra!

### 🏢 Cerca organizzazioni

**Tu chiedi**: "Quali organizzazioni hanno 'salute' nel nome in dati.gov.it?"

Ricerca tra tutte le organizzazioni registrate sul portale.

**Risultato**: 7 organizzazioni trovate (as of 1 febbraio 2026), tra cui:
- Ministero della Salute (51 dataset)
- Agenzia di Tutela della Salute di Pavia (10 dataset)
- Agenzia di Tutela della Salute di Brescia (10 dataset)

**Tool usato**: `ckan_organization_search`

---

### 🏷️ Scopri i tag più popolari

**Tu chiedi**: "Quali sono i 10 tag più usati su dati.gov.it?"

Ottieni la classifica dei tag più popolari, perfetto per capire quali temi sono più coperti!

**Top 3** (as of 1 febbraio 2026):
1. "eu": 8.032 dataset
2. "N_A": 7.285 dataset
3. "lamma": 6.443 dataset

**Tool usato**: `ckan_tag_list`

---

### 📁 Esplora gruppi tematici

**Parte 1 - Elenco dei gruppi**

**Tu chiedi**: "Quali gruppi tematici ci sono in dati.gov.it?"

**Risultato** (as of 1 febbraio 2026):
Agricoltura, Ambiente, Cultura, Economia, Energia, Giustizia, Governo, Internazionali, Regioni, Salute, Scienza, Società, Trasporti.

**Tool usato**: `ckan_group_list`

---

**Parte 2 - Dettaglio di un gruppo**

**Tu chiedi**: "Quanti dataset ci sono nel gruppo 'Scienza'?"

**Risultato**: 2.651 dataset nel gruppo Scienza (as of 1 febbraio 2026).

I gruppi sono raccolte curate di dataset su temi specifici (Ambiente, Salute, Economia, ecc.).

**Tool usato**: `ckan_group_show`

---

### ✅ Verifica la qualità di un dataset

**Tu chiedi**: "Qual è il punteggio di qualità del dataset sugli appalti ANAC 2018 su dati.gov.it?"

Il sistema interroga le **metriche MQA** (Metadata Quality Assessment) di data.europa.eu:

**Dataset**: "ocds-appalti-ordinari-anno-2018" (ANAC)
**Punteggio complessivo**: 395/405 (quasi perfetto!) (as of 1 febbraio 2026)
Nota: su data.europa.eu l'id risulta "ocds-appalti-ordinari-2018" (senza "anno").

**Dettaglio dimensioni**:
- ✅ Accessibilità: 100/100
- ⚠️ Riusabilità: 65/75
- ✅ Interoperabilità: 110/110
- ✅ Rintracciabilità: 100/100
- ✅ Contestualità: 20/20

Perfetto per valutare se un dataset è ben documentato e utilizzabile!

**Tool usato**: `ckan_get_mqa_quality`

---

### 🔍 Query SQL avanzate (datastore)

**Tu chiedi**: "Conta quante ordinanze per tipo ci sono nel dataset di Messina"

SQL direttamente sul DataStore:

```sql
SELECT tipo, COUNT(*) as totale
FROM "17301b8b-2a5b-425f-80b0-5b75bb1793e9"
GROUP BY tipo
ORDER BY totale DESC
LIMIT 5
```

**Risultato**:
1. divieto_sosta: 1.015
2. lavori: 267
3. divieto_transito: 259
4. autorizzazione: 192
5. divieto_sosta, divieto_transito: 186

Per analisi complesse, quando i filtri semplici non bastano!

**Tool usato**: `ckan_datastore_search_sql`

---

### 🌐 Verifica se un portale è online

**Tu chiedi**: "Il portale dati.gov.it è raggiungibile? Che versione usa?"

Verifica lo stato del server (as of 1 febbraio 2026):
- ✅ online
- Versione CKAN: 2.10.3
- Titolo: "Dati Gov IT"
- Descrizione: "Portale Nazionale Dati Aperti - AGID"

Utile prima di lanciare query su portali che non conosci!

**Tool usato**: `ckan_status_show`

---

## 📊 Comparazione: web vs MCP server

| Metodo | Steps | Tempo | Precisione |
|--------|-------|-------|-----------|
| **Interfaccia Web** | Clicca → cerca → filtra → pagina → rifiltra → pagina → esporta → analizza | 10-15 minuti | Dipende da te |
| **MCP Server** | Chiedi → ottieni | 30 secondi | Sempre precisa |

Vedi la differenza? 😎

---

## 🎯 Casi d'uso reali

### Giornalista data-driven 📰

**Scenario**: Stai scrivendo un articolo su appalti pubblici e vuoi dati freschi.

**Domanda**: "Trova dataset su appalti aggiornati negli ultimi 3 mesi su dati.gov.it"

**Risultato**: 32 dataset, tutti recenti e pronti per l'analisi! (as of 1 febbraio 2026)

---

### Ricercatore open data 🔬

**Scenario**: Vuoi studiare quali enti pubblicano più dati aperti.

**Domanda**: "Analizza quali organizzazioni hanno creato più dataset negli ultimi 6 mesi"

**Risultato**: Classifica pronta (Toscana: 12.602, Veneto: 6.555, Lombardia: 3.304) (as of 1 febbraio 2026), perfetta per il tuo paper!

---

### Civic hacker 💻

**Scenario**: Vuoi monitorare nuovi dataset su mobilità urbana per creare una app.

**Domanda**: "Cerca dataset su mobilità urbana pubblicati nell'ultimo mese"

**Risultato**: 5 dataset (as of 1 febbraio 2026). Feed di novità, sempre aggiornato.

---

## 🚀 Getting started

Vuoi provare? La configurazione richiede **2 minuti**:

1. Installa il server (vedi [README.md](../README.md))
2. Configura il tuo client MCP
3. Inizia a chiedere!

La tua AI fa il resto. Nessun codice da scrivere, solo domande da fare.

---

## 🌟 Cosa rende speciale questo strumento?

- ✅ **Impari una volta, usi ovunque**: stesso metodo per tutti i portali CKAN
- ✅ **Veloce**: secondi invece di minuti
- ✅ **Preciso**: query avanzate senza imparare linguaggi complicati
- ✅ **Flessibile**: da ricerche semplici ad analisi complesse
- ✅ **Accessibile**: nessuna programmazione richiesta
- ✅ **Open Source**: codice libero, migliora con la community!
- ✅ **DataStore**: interroga direttamente i dati (quando disponibile)

---

## 🤔 Domande frequenti

**Q: Devo imparare a programmare?**
A: No! Chiedi in linguaggio naturale, la tua AI traduce per te.

**Q: Funziona solo su dati.gov.it?**
A: No! Funziona su **qualsiasi portale CKAN**: Italia, USA, UK, Canada, EU...

**Q: Posso interrogare direttamente i dati nei CSV?**
A: Sì, se il portale ha il DataStore attivo (tipicamente portali locali come comuni e regioni).

**Q: Con quale AI funziona?**
A: Con qualsiasi client che supporta MCP (Model Context Protocol).

**Q: È gratis?**
A: Sì, il server è open source. Serve un client MCP compatibile.

**Q: Posso contribuire?**
A: Assolutamente! Questo è un progetto open source: [GitHub repo](https://github.com/ondata/ckan-mcp-server)

---

## 💡 Prossimi passi

Pronto a provare? Vai al [README.md](../README.md) per l'installazione!

Hai domande o idee? Apri una [issue su GitHub](https://github.com/ondata/ckan-mcp-server/issues)!

---

**Happy data hunting!** 🎉📊🔍
