# Backend-Claude — Handoff: ontblokkeer de frontend-afronding (Koios Match)

> **Kopieer dit als prompt naar backend-Claude (repo `koiosmatch-api`).** Het beschrijft
> wat de **frontend al consumeert** maar de backend nog moet leveren, plus de prioriteit en
> de exacte contracten. Bron-van-waarheid blijft `docs/ARCHITECTURE.md`, `docs/worklist.md §C`
> en `docs/DATA-API.md` in de **frontend**-repo — verwijs daarnaar voor detail; dupliceer niet.

---

## Rol

Je bent een **Senior Laravel-engineer (35+ jaar)** voor **Koios Match** — een **multi-tenant SaaS**
voor Nederlandse zorg-flexbemiddeling. De data is **bijzondere categorie persoonsgegevens
(gezondheid)** onder de AVG. Eén centrale core-API achter een load balancer bedient alle tenants
vanuit één database. Aparte servers: WhatsApp-privé + workflow/AI-runtime.

## Lees eerst (source of truth — frontend-repo)

1. `docs/ARCHITECTURE.md` — entiteiten, de 3 assen (status/funnel/candidate-type), match-model, API-contract.
2. `docs/worklist.md §C` — de volledige backend-backlog (C-0 … C-38) met detail per taak.
3. `docs/DATA-API.md` — exact wat de FE aanroept (CRUD-matrix) + de datalaag-gaten (D-1..D-6).
4. `docs/DECISIONS.md` — bindende keuzes (K-1..K-17) + doel-topologie + schaalbaarheid.
5. `backend-CLAUDE.md` (jouw repo) — conventies (mirror van de FE-CLAUDE.md §3-maattabel).

## Niet-onderhandelbaar (constraints, geen features)

- **Tenant-isolatie waterdicht.** `tenant_id` FK op **elke** tenant-tabel + een **Global Scope**
  op elk model zodat geen query ooit cross-tenant data raakt. Vertrouw **nooit** een tenant-id uit
  de request — alleen uit de geauthenticeerde sessie.
- **Indexes** op `tenant_id` en elke veelgefilterde kolom (`status`, `funnel_type`, `owner_id`,
  `deleted_at`, datums). Voorkom N+1 (eager-load relaties).
- **AVG:** soft-delete only voor cliënt-acties (`deleted_at`); **hard-delete is API-only** en
  alleen toegestaan als er niets meer aan hangt (live applications/matches/placements). Respecteer
  geanonimiseerde/erased staat. **Nooit PII in logs.**
- **Migratie-conventie (hard):** **NOOIT** een `add_*` / `alter_*` / `change_*`-migratie. Vouw elke
  schemawijziging in de bestaande `create_<table>`-migratie (nieuw migratiebestand = alleen voor een
  **nieuwe** tabel). Toepassen via `php artisan migrate:fresh` / `dev:reset` (pre-release).
- **Thin controllers** (≤ ~150 r: ontvang → delegeer → Resource; geen logica/queries). Business-logica
  in **Service/Action** (~200–300 r, één publieke methode). **FormRequest** valideert alles vooraf.
  Output via **API Resources**.
- **Endpoint-naamgeving:** native = schoon/prefix-loos (`/candidates`, `/customers`, `/tasks`, …).
  Externe spiegels met bron-prefix: **ShiftManager `sm_`**, **HelloFlex `hf_`**. Nooit een native
  resource prefixen.
- **Stateless** (load balancer): geen lokale sessies/file-uploads. **Redis** sessions; object-storage
  (S3-achtig) voor documenten/CV. `dev:reset` mag **nooit** externe API's (Meta/SM/HF) raken.
- **Veldnamen = `snake_case`** en moeten matchen met wat de FE mapt (`mapCandidate.js`, `mapTask.js`,
  `mapVacancy.js`, …). De FE-mapper is leidend voor het detail-shape.

## Werkwijze & Definition of Done

- **Klein, groen per golf:** na elke taak `migrate:fresh` + seed + feature-tests groen.
- Lijst-response: bare array of `{data,meta}`; detail: bare object of `{data}` (consistent per resource).
- Lookups: **CRUD + 409 `in_use`-vlag** (referenced value niet deletebaar) + **reorder** + **geseed**.
- Sluit af met een **self-audit** (tenant-scope? indexes? migratie in `create_`? Resource? geen PII-log?
  tests groen?). Wees eerlijk over wat nog niet af is.

---

## P0 — Fundering (alles hangt hieraan)

- **C-0 · Volledige seeder (Yesway + demo).** Alle lookups + realistische sample-data voor beide
  tenants. Geen lege schermen. Idempotent; draait mee in `dev:reset`.
- **C-10 · Status/funnel reseed.** Status = `lead · candidate · matched · inactive · unplaceable`.
  **Blacklist = aparte boolean-vlag** (niet in de status-lijst). **Archived = `deleted_at`** (geen
  status). `inactive`/`blacklist`/`archived` standaard **uit** in filters (wel zoekbaar). `inactive`
  vereist een reden + alleen toegestaan zonder actieve Match/toekomstige inplanning. Status/availability-
  wissels loggen `effective_from` + `reason`.

## P1 — Ontblokkeert de frontend-afronding (audit-handoffs)

> Deze staan de FE-afronding direct in de weg. Lever endpoint + Resource + seed + tests.

- **F-13 · Auth → httpOnly-cookieflow (BE-8, gecoördineerde deploy).** Doel = Sanctum SPA-cookie
  (FE-scaffold staat: `withCredentials`/CSRF). Backend: `SANCTUM_STATEFUL_DOMAINS=app.koiosmatch.com,
  development.app.koiosmatch.com` · `SESSION_DOMAIN=.koiosmatch.com` · `SESSION_SECURE_COOKIE=true` ·
  `SESSION_SAME_SITE=lax` · CORS `supports_credentials=true` + allowed origins · `/sanctum/csrf-cookie`-
  route · **`SESSION_DRIVER=redis`** (multi-server/LB) vóór de flip. **Eén atomair deploy-window** met
  de FE-flip (`VITE_COOKIE_AUTH=true`). API-keys-feature blijft token-based.
- **MOCK-1 · Planning-endpoints per kandidaat.** De FE-Planning-tab draait nu op dummy. Lever
  (read-first): `GET /candidates/{id}/shifts`, `…/agenda`, `…/open-shifts`, `…/favorites` (+ seed).
  Shape afstemmen op `pages/candidates/data/mocks.ts` (`AGENDA_SHIFTS`/`DUMMY_*`).
- **D-1 · Changelog over álle entiteiten.** `GET /{resource}/{id}/activity` (zoals candidates al heeft)
  voor `customers · vacancies · applications · tasks · opportunities`. Append-only, `subject_*` + `ip`,
  tenant-scoped.
- **D-2 · Soft-delete (archive) breed.** `POST /{resource}/bulk/archive` (= `deleted_at`) voor
  `tasks · opportunities · applications` (candidates/customers/vacancies hebben 'm al).
- **D-3 · Gearchiveerd bekijken + herstellen.** `GET /{resource}?archived=1` (of `trashed`) + `POST
  /{resource}/{id}/restore`. Hard-delete blijft API-only met dependency-check (409 als er iets hangt).
- **D-4/D-5 · Tasks compleet maken.** `GET /tasks/stats` (server-brede tellingen, niet paginabreed) +
  `GET /tasks/{id}/activity` (de tab bestaat al in de FE).
- **CFG-1 · Drie hardcoded vocabularies → tenant-lookups.** `/nationalities`, `/languages`
  (bevestig of die al bestaat), en een **customer-status-lookup** — elk als lookup-CRUD-contract
  (CRUD + 409 `in_use` + reorder + seed). De FE leest ze read-only via `useX()`.

## P2 — De complete kandidaat + de andere entiteiten

> Detail per taak in `worklist.md §C`. Kop-lijst zodat je de samenhang ziet:

- **Kandidaat compleet (C-38-kaart):** sub-entiteit body-contracten (**C-2**), álle velden incl.
  `place_of_birth`/`facebook_lead_id` (**C-23**), `last_contact_at`/`_type` + soft-delete-filters
  (**C-21**), kanaal-consent `*_opt_in` (**C-11**), branches (**C-4**), afspraken/intakes +
  `requires_appointment` + `GET /reports/intakes` (**C-22**), instellingen/voorkeuren-opslag +
  lookups + `/note-types` + `/document-types` + `candidate_cv_template` (**C-36 / C-37**).
- **Entiteiten naar blueprint:** vacancies tabel/endpoints/bulk/seed (**C-26**), tasks volledig
  (**C-18**), matches tabel/endpoint/seed (**C-19**), applications seeder + `match_score` (**C-20**),
  klanten + sub-entiteiten + seed (**C-27**).
- **Dashboard & rapporten:** `GET /dashboard` (**C-30**), `GET /reports/flow|recruiters|intakes|
  vacancies|matches` (**C-34**), charts-data (**C-31**), `dashboard_type` op rollen (**C-35**),
  `ui_preferences` op users (**C-33**).
- **Workflow-graaf (C-27-workflow):** steps opslaan met `position` + `connections[]` (`{target,
  filters}`) en **stabiele step-`id`'s** (anders flatten Router-takken). Filter-`field`-keys moeten
  matchen met het datamodel (`function_title`, `owner_id`, `funnel_type` — niet `function`/`owner`/
  `funnel_stage`).
- **Lookups in-use + reorder (C-1):** verifieer met ingelogde sessie dat toevoegen/reorder werkt en
  409 + `in_use` correct is.

## Contract-template (lever dit per endpoint)

```
<METHOD> /<path>            — auth + tenant-scope + policy
Request  : { … }           (snake_case; FormRequest-regels)
Response : { … } of {data} (snake_case; matcht de FE-mapper)
Errors   : 401/403/404/409 (409 = in_use / dependency)
Seed     : welke demo-data (Yesway + demo), idempotent
Index    : tenant_id + gefilterde kolommen
Tests    : happy path + tenant-isolatie + 4xx
```

---

**Aanpak-volgorde:** P0 (seeder + status-reseed) → P1 (de 6 audit-handoffs, want die ontblokkeren de
FE-afronding nu) → P2 per entiteit. Werk klein en groen; vraag bij elke echte keuze (datamodel/shape)
éérst Danny om akkoord voordat je 'm vastlegt.
