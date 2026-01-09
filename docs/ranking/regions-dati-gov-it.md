# dati.gov.it Region → Organization Slug Mapping

These slugs correspond to CKAN organization IDs on https://www.dati.gov.it/opendata.
They are used to build filter queries like `fq=organization:regione-lombardia`.

- Abruzzo → `regione-abruzzo`
- Basilicata → `regione-basilicata`
- Calabria → `regione-calabria`
- Campania → `regione-campania`
- Emilia-Romagna → `regione-emilia-romagna`
- Friuli-Venezia Giulia → `regione-friuli-venezia-giulia`
- Lazio → `regione-lazio`
- Liguria → `regione-liguria`
- Lombardia → `regione-lombardia`
- Marche → `regione-marche`
- Molise → `regione-molise`
- Piemonte → `regione-piemonte`
- Puglia → `regione-puglia`
- Sardegna → `regione-sardegna`
- Sicilia → `regione-sicilia`
- Toscana → `regione-toscana`
- Trentino-Alto Adige / Südtirol → `regione-trentino-alto-adige-sudtirol`
- Umbria → `regione-umbria`
- Valle d'Aosta / Vallée d'Aoste → `regione-valle-daosta`
- Veneto → `regione-veneto`

Notes:
- Verify a slug by testing: `ckanapi action package_search -r https://www.dati.gov.it/opendata q=*:* rows=1 fq=organization:<slug>`.
- If an organization uses a different slug, update this list accordingly.
