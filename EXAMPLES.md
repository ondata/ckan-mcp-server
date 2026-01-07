# Esempi di Query CKAN MCP

Questo file contiene esempi pratici di utilizzo del server CKAN MCP.

## Test Connessione

### Verifica stato server
```typescript
ckan_status_show({
  server_url: "https://demo.ckan.org"
})
```

### Lista dataset
```typescript
ckan_package_search({
  server_url: "https://demo.ckan.org",
  q: "*:*",
  rows: 10
})
```

## Esempi Italia - dati.gov.it

### Cerca dataset recenti
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "*:*",
  sort: "metadata_modified desc",
  rows: 20
})
```

### Dataset su COVID-19
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "covid OR coronavirus",
  rows: 20
})
```

### Dataset della Regione Siciliana
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "organization:regione-siciliana",
  sort: "metadata_modified desc",
  rows: 20
})
```

### Cerca organizzazioni con wildcard
```typescript
// Trova tutte le organizzazioni che contengono "salute" nel nome
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "organization:*salute*",
  rows: 0,
  facet_field: ["organization"],
  facet_limit: 100
})
```

### Statistiche per organizzazione
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["organization"],
  facet_limit: 20,
  rows: 0
})
```

### Statistiche per formato risorse
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["res_format"],
  facet_limit: 50,
  rows: 0
})
```

### Lista organizzazioni
```typescript
ckan_organization_list({
  server_url: "https://www.dati.gov.it/opendata",
  all_fields: true,
  sort: "package_count desc",
  limit: 20
})
```

### Dettagli organizzazione specifica
```typescript
ckan_organization_show({
  server_url: "https://www.dati.gov.it/opendata",
  id: "regione-siciliana",
  include_datasets: true
})
```

### Dataset con formato CSV
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "res_format:CSV",
  rows: 20
})
```

## Esempi USA - data.gov

### Cerca dataset governativi
```typescript
ckan_package_search({
  server_url: "https://catalog.data.gov",
  q: "climate change",
  rows: 20
})
```

### Dataset per tag
```typescript
ckan_package_search({
  server_url: "https://catalog.data.gov",
  q: "tags:health",
  rows: 20
})
```

## Esempi Demo CKAN

### Esplora demo.ckan.org
```typescript
ckan_status_show({
  server_url: "https://demo.ckan.org"
})
```

```typescript
ckan_organization_list({
  server_url: "https://demo.ckan.org",
  all_fields: true
})
```

```typescript
ckan_package_search({
  server_url: "https://demo.ckan.org",
  q: "*:*",
  facet_field: ["organization", "tags", "res_format"],
  rows: 10
})
```

## Query DataStore

### Query base su risorsa
```typescript
ckan_datastore_search({
  server_url: "https://demo.ckan.org",
  resource_id: "5b3cf3a8-9a58-45ee-8e1a-4d98b8320c9a",
  limit: 100
})
```

### Query con filtri
```typescript
ckan_datastore_search({
  server_url: "https://demo.ckan.org",
  resource_id: "5b3cf3a8-9a58-45ee-8e1a-4d98b8320c9a",
  filters: {
    "Country": "Italy"
  },
  limit: 50
})
```

### Query con ordinamento
```typescript
ckan_datastore_search({
  server_url: "https://demo.ckan.org",
  resource_id: "5b3cf3a8-9a58-45ee-8e1a-4d98b8320c9a",
  sort: "Year desc",
  limit: 100
})
```

## Ricerche Avanzate con Solr

### Combinazione AND
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "popolazione AND sicilia",
  rows: 20
})
```

### Combinazione OR
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "sanità OR salute OR health",
  rows: 20
})
```

### Esclusione NOT
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "dati NOT personali",
  rows: 20
})
```

### Ricerca per titolo
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "title:popolazione",
  rows: 20
})
```

### Ricerca per descrizione
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "notes:istat",
  rows: 20
})
```

### Wildcard
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "popola*",
  rows: 20
})
```

### Filtro per range date
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "metadata_modified:[2023-01-01T00:00:00Z TO 2023-12-31T23:59:59Z]",
  rows: 20
})
```

### Dataset modificati nell'ultimo mese
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "metadata_modified:[NOW-1MONTH TO NOW]",
  sort: "metadata_modified desc",
  rows: 20
})
```

## Workflow Completi

### Workflow 1: Analisi Dataset Regionali

```typescript
// Step 1: Lista organizzazioni regionali
ckan_organization_list({
  server_url: "https://www.dati.gov.it/opendata",
  all_fields: true,
  sort: "package_count desc",
  limit: 50
})

// Step 2: Seleziona una regione e cerca i suoi dataset
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "organization:regione-siciliana",
  sort: "metadata_modified desc",
  rows: 50
})

// Step 3: Ottieni dettagli di un dataset interessante
ckan_package_show({
  server_url: "https://www.dati.gov.it/opendata",
  id: "nome-dataset-trovato"
})
```

### Workflow 2: Monitoraggio Nuove Pubblicazioni

```typescript
// Dataset pubblicati negli ultimi 7 giorni
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "metadata_created:[NOW-7DAYS TO NOW]",
  sort: "metadata_created desc",
  rows: 50
})

// Dataset modificati negli ultimi 7 giorni
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "metadata_modified:[NOW-7DAYS TO NOW]",
  sort: "metadata_modified desc",
  rows: 50
})
```

### Workflow 3: Analisi Copertura Dati

```typescript
// Step 1: Statistiche formati
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["res_format"],
  facet_limit: 100,
  rows: 0
})

// Step 2: Statistiche licenze
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["license_id"],
  facet_limit: 50,
  rows: 0
})

// Step 3: Statistiche organizzazioni
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["organization"],
  facet_limit: 100,
  rows: 0
})

// Step 4: Tag più usati
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["tags"],
  facet_limit: 50,
  rows: 0
})
```

### Workflow 4: Ricerca Tematica Specifica

```typescript
// Esempio: Dataset su ambiente e clima

// Step 1: Ricerca generale
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "ambiente OR clima OR inquinamento OR emissioni",
  facet_field: ["organization", "tags"],
  rows: 50
})

// Step 2: Raffina con filtri
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "ambiente",
  fq: "tags:aria AND res_format:CSV",
  sort: "metadata_modified desc",
  rows: 20
})

// Step 3: Analizza organizzazioni che pubblicano su questo tema
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "ambiente",
  facet_field: ["organization"],
  rows: 0
})
```

## Output Formati

### Formato Markdown (default)
Leggibile, formattato con tabelle e sezioni

### Formato JSON
Per elaborazione programmatica

```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "popolazione",
  rows: 10,
  response_format: "json"
})
```

## Note

- La paginazione default è 10 risultati per `package_search`
- Il massimo è 1000 risultati per chiamata
- Per dataset molto grandi, usa `start` per paginare
- Il DataStore ha un limite di 32000 record per query
- Non tutti i dataset hanno risorse nel DataStore (controlla `datastore_active`)
