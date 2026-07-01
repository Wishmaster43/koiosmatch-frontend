# Backend-Claude — Master-Handoff (Koios Match) · ⚠️ SUPERSEDED

> 🛑 **DIT DOCUMENT IS ACHTERHAALD — LEES HET NIET ALS BRON.** De backend **bezit** het contract:
> lees **`FRONTEND-CONTRACT.md`** (backend-repo, code-geverifieerd) + de backend **`CLAUDE.md`**. Dit
> bestand is een *handmatige FE-beschrijving van de backend* en dríft daardoor gegarandeerd — het bevatte
> o.a. het **verkeerde tenancy-model** (single-DB `tenant_id`; de backend is **Stancl multi-DB**, isolatie
> via de connectie, géén `tenant_id`-kolom). Het staat op **retirement** (ACTION-PLAN **AP-P3/AP-C4**).
> Alleen de **geprioriteerde backlog** hieronder heeft nog nut als naslag.

> **Lees dít document volledig.** Het is **zelfdragend**: rol, constraints, de bindende beslissingen,
> het **datamodel (v2)**, de lookups, de endpoint-conventies én de geprioriteerde backlog staan hieronder.
> Je hebt geen ander document nodig om te weten *wat* te bouwen en *in welke volgorde*.
>
> **Alleen voor veld-detail** (exacte snake_case-velden per resource) raadpleeg je de FE-repo als naslag —
> **niet** als tegenbron:
> - `docs/worklist.md §C` = per-taak detail (C-0 … C-44).
> - `src/pages/*/data/mapX.js` (`mapCandidate`, `mapVacancy`, `mapTask`, `mapOpportunity`) = **leidend** voor het detail-shape.
> - `docs/DECISIONS.md` = het volledige keuzelog (K-1..K-31) + schaalbaarheid.
>
> ⚠️ **Let op — bekende drift:** `docs/ARCHITECTURE.md §2/§3` bevat nog het **oude v1-status-model**
> (`lead·candidate·matched·inactive·unplaceable` + blacklist-vlag + losse availability). **Negeer dat.**
> Het model in **§3 hieronder is v2 en leidend** (CLAUDE.md §3B / DECISIONS K-18 / worklist C-10). ARCHITECTURE.md
> wordt nog gelijkgetrokken.
>
> **Laatst bijgewerkt:** 2026-07-01.

---

## 1. Rol & niet-onderhandelbare constraints (géén features — dit zijn kaders)

Je bent **Senior Laravel-engineer (35+ jaar)** voor **Koios Match** — multi-tenant SaaS voor Nederlandse
zorg-flexbemiddeling. Data = **bijzondere categorie persoonsgegevens (gezondheid)** onder de AVG. Eén centrale
core-API achter een load balancer bedient alle tenants uit één database. Aparte servers: **WhatsApp-privé** +
**workflow/AI-runtime**.

- **Tenant-isolatie waterdicht (multi-DB — CORRECTIE AP-C4).** Isolatie komt uit de **connectie**, niet uit
  een kolom: **Stancl Tenancy v3 multi-database** (aparte DB per tenant). **GÉÉN `tenant_id`-kolom, GÉÉN
  `BelongsToTenant`, GÉÉN tenant-global-scope** op tenant-modellen; central-only modellen pinnen via
  `UsesCentralConnection`. Een handmatige `where('tenant_id', …)` is een *red flag* dat iets op de verkeerde
  connectie staat. (De eerdere "`tenant_id` FK + Global Scope"-tekst was fout — single-DB — en is verwijderd.)
- **Indexes** op `tenant_id` + elke veelgefilterde kolom (`status`, `phase`, `funnel_type`, `owner_id`,
  `deleted_at`, datums). Voorkom N+1 (eager-load).
- **AVG:** soft-delete only voor cliënt-acties (`deleted_at`); **hard-delete = API-only** en alleen als er niets
  meer aan hangt (live applications/matches/placements → anders 409). Respecteer geanonimiseerde/erased staat.
  **Nooit PII in logs.**
- **Migratie-conventie (hard):** **NOOIT** een `add_*`/`alter_*`/`change_*`-migratie. Vouw elke schemawijziging in
  de bestaande `create_<table>`-migratie (nieuw migratiebestand = alleen voor een **nieuwe** tabel). Toepassen via
  `php artisan migrate:fresh` / `dev:reset` (pre-release). `dev:reset` mag **nooit** externe API's (Meta/SM/HF) raken.
- **Thin controllers** (≤ ~150 r: ontvang → delegeer → Resource; geen logica/queries). Logica in **Service/Action**
  (~200–300 r, één publieke methode). **FormRequest** valideert alles vooraf. Output via **API Resources**.
- **Endpoint-naamgeving:** native = schoon/prefix-loos (`/candidates`, `/customers`, `/tasks`, …). Externe spiegels
  met bron-prefix: **ShiftManager `sm_`**, **HelloFlex `hf_`**. Nooit een native resource prefixen.
- **Stateless** (LB): geen lokale sessies/uploads. **Redis** sessions; object-storage (S3-achtig) voor documenten/CV.
- **Veldnamen = `snake_case`**, matchend met de FE-mapper (die is leidend voor het detail-shape).

---

## 2. Bindende beslissingen (backend-relevant · volledig log = DECISIONS.md K-1..K-31)

| # | Beslissing (backend-impact) |
|---|---|
| K-1 | Productnaam **Koios Match / KoiosMatch** — nooit "KoiosConnect". |
| K-2 | **Auth = Sanctum httpOnly-cookieflow.** Domeinen: FE `app.koiosmatch.com` + `development.app.koiosmatch.com`, API `api.koiosmatch.com`, `SESSION_DOMAIN=.koiosmatch.com`, `SAME_SITE=lax`, `SESSION_SECURE_COOKIE=true`, CORS `supports_credentials=true`, `/sanctum/csrf-cookie`-route, **`SESSION_DRIVER=redis` vóór de flip**. **Eén atomair deploy-window** met de FE-flip. API-keys-feature blijft token-based. |
| K-3/K-28 | **Workflow-engine op aparte server** (runs/logs/queues). Run-**metadata** lang bewaren, run-**I/O-payload** kort → purgen (AVG); **max runtime** per-stap + workflow-wall-clock (pakket-configureerbaar); stuck/timeout-statussen. |
| K-4/K-32b | **3 pakketten (Core/Pro/Enterprise) + losse add-ons + connectors.** Super-admin schakelt per tenant. `GET /admin/tenants/{id}/usage` (alleen hoeveelheden, geen tarieven). |
| K-6 | **Source-prefix endpoints** (`sm_`/`hf_` extern, schoon native). |
| K-8 | **Soft-delete only** (cliënt-acties); hard-delete API-only met dependency-check (409). |
| K-9 | **Migratie-conventie** (zie §1). |
| K-18 | **Assen-model v2** (zie §3) — vervangt het oude 3-assen/single-status-model. |
| K-20 | **Matches-planbord = sleepbaar** (fase via drag) — bewuste uitzondering; MatchesTab op de kandidaat blíjft read-only. |
| K-21 | **WhatsApp-privé = aparte outbox-entiteit** (`whatsapp_outbox`, niet raw `jobs`) + classificatie/prioriteit/rate-limit per nummer. |
| K-22 | **Subtaken op taken = JA** (`tasks.parent_id` of lichte subtasks-tabel). |
| K-23 | **Bellijsten/Outreach = eigen entiteit** (`outreach_campaigns` + `outreach_targets`), niet een taak overladen. |
| K-24 | **Kans = zorg-detacherings-opportunity**: waarde (€) **én** uren los; looptijd = start+eind-datum; dienst/overeenkomst = lookups; org-koppeling klant→locatie→afdeling→contact; taken op de Kans. |
| K-25 | **Native Planning-module = eigen entiteiten, 0% mock** (`planning_orders/shifts/assignments/hours` + Settings-lookups). |
| K-26 | **Vacature-detail = kandidaat-parity** + **`match_profiles`** als eigen entiteit (Settings-default + per-vacature override). |
| K-27 | **Custom fields** getypeerd (text/number/date/select/boolean/textarea) + server-validatie + `label_i18n` + merge-modal + `show_in_table` + verplichte velden per fase. |
| K-30 | **CV-template** van browser-localStorage → tenant-`/settings` (`candidate_cv_template`). |

---

## 3. Datamodel — **v2, leidend** (dit vervangt ARCHITECTURE.md §2/§3)

### 3.1 Kernprincipe — alles is gelinkt
Candidate · Opportunity · Vacancy · Application · Match · Task · Workflow · TalentPool · Customer → Location →
Department → Contact vormen **één verbonden graaf**. Vanuit elke hoek moet je de gekoppelde records bereiken.

**Native entiteiten:** candidates · applications · vacancies · matches · opportunities · tasks · customers ·
locations · departments · contacts · pools · **planning (orders/shifts/assignments/hours)** · **appointments** ·
**outreach (campaigns/targets)**. **Externe spiegels:** `sm_*` (ShiftManager) · `hf_*` (HelloFlex).

**Candidate sub-entiteiten:** experiences · educations · certifications · skills · languages · documents · pools ·
branches · applications[] · matches[] · notes · timeline.

### 3.2 De assen die één persoon beschrijven — **zes assen, elk één vraag** (nooit samenvouwen)

| As | Kardinaliteit | Waar | Seed-waarden | Regels |
|---|---|---|---|---|
| **Contractvorm** (was "candidate type") | **multi** | `candidate_types`-lookup (alleen FE-**label** wijzigt; keys onveranderd) | detachering · flex · uzk · zzp · payroll · oproep · freelance | "In welke contractvorm(en)?" Verandert zelden. |
| **Fase** (lifecycle) | single | **NIEUWE** `candidate_phases`-lookup + `/settings/candidate-lookups/phases` + `phase`-kolom (default `lead`) | `lead · candidate` (+ later `alumni`) | Lead→candidate **automation** (1e sollicitatie/intake). |
| **Inzetbaarheid** (= wat "status" nu is) | single | `candidate_statuses`-lookup (herzien; availability **erin gevouwen**) | `available · placed · unavailable · sick · leave · blacklist` | **`placed` vereist gekoppelde Match** (handmatig → verplicht Match; auto via funnel `hired`). `unavailable` = weer-beschikbaar-datum + reden. |
| **Blacklist** | (waarde van Inzetbaarheid) | `candidate_statuses` seed `blacklist` met vlag **`requires_reason`**, kleur `#DC2626` | — | **Géén aparte kolom/vlag** (2026-06-30). Oude `blacklisted`-boolean verwijderd. |
| **Archived** | soft-delete | `deleted_at` | — | Geen status. Standaard **uit** in filters (wel zoekbaar → KPI-totalen dalen). |
| **Funnel** | single **per sollicitatie** | `funnel-types`-lookup, op de **application** | `applied · invited/intake · proposal · hired · rejected` | Op de kandidaat alleen **read-only chips**. "Sollicitant" = afgeleid (≥1 lopende sollicitatie). |

**Status/status v2-reseed = ✅ C-10 Golf ② AFGEROND (2026-07-01):** volledige set incl. `blacklist`, oude
`blacklisted`-boolean + `where blacklisted`-logica weg (gevouwen in `create_candidates`), `?status[]=blacklist` → 200,
`dev:reset` op alle tenants. **Nog te leveren:** `candidate_phases`-lookup + `phase`-automation + de gedateerde
transitie-changelog (zie 3.3/3.4).

### 3.3 Fase ↔ inzetbaarheid ↔ funnel = **automatisering**, geen veld-koppeling
Gestuurd door workflow-automation (geseed, instelbaar):
1. eerste sollicitatie → Fase `lead` wordt `candidate`;
2. funnel **hired** → maak een **Match** + zet Inzetbaarheid **placed**;
3. **rejected** zonder andere lopende sollicitatie → Fase blijft `candidate`.

**Guards:** `placed` alleen met gekoppelde Match; `unavailable` alleen met **geen actieve Match** + (planning-module)
**geen toekomstige inplanning** — anders blokkeren met reden.

### 3.4 Gedateerd + beredeneerd
Elke **Fase- én Inzetbaarheid-transitie** logt `effective_from` + (voor inzetbaarheid) `reason` — bv. "Kandidaat
sinds 31-05-2026" / "Niet beschikbaar sinds … · reden". Kleine change-log, gekoppeld aan de audit-trail (C-16).

### 3.5 Twee paden naar een plaatsing (entry = nieuwe Lead óf bestaande Kandidaat)
1. **Via funnel:** vacature → sollicitatie → funnel → `hired` → **Match** → plaatsing.
2. **Direct match:** `POST /matches {candidate_id, vacancy_id}` zonder funnel → plaatsing.
Beide → Inzetbaarheid `placed`. Een Match voegt automatisch een **werkervaring** bovenaan toe (workflow).

### 3.6 Match-model (3 lagen)
1. **Match-score** = fit (0-100% + criteria) plat op de **sollicitatie** (`applications.match_score` + `match_criteria` + `match_summary`).
2. **Match** = eigen entiteit (`matches`-tabel, `GET /matches`). **1 vacature : N matches.**
3. **Contract** = duur/schaal/trede/tarief leeft **volledig in HelloFlex**; wij bewaren alléén `helloflex_contract_guid` + `contract_status` op de match. **Geen eigen contract-tabel.**
Backoffice/ShiftManager-koppeling (handmatig/bulk/workflow) = autorisatie-gated, **queue + rate-limit**, mapping-fout terug op de kandidaat.

### 3.7 Afspraken / intakes (appointment-gated funnel-fasen)
Een funnel-fase kan **`requires_appointment`** vereisen (vlag, **geen hardcoded slug** — tenants hernoemen fasen).
Geen geplande afspraak op zo'n fase → **inconsistentie-vlag** op de kandidaat (icon + `missing_appointment`-teller).
**Appointments** = aparte tenant-entiteit (`scheduled_at`/`scheduled_from`/`scheduled_to`, recruiter/owner, locatie/branch,
type-lookup, status), gelinkt aan kandidaat (+ optioneel application). **Intake-rapport** `GET /reports/intakes`
(slice: dag/week/maand × recruiter × branch × source × functie × regio) — de "Intake gepland"-KPI derivt uit
appointments op een `requires_appointment`-fase, **niet** uit een status.

---

## 4. Configureerbare lookups (Settings → API, **nooit hardcoded**)
Elke lookup = tenant-scoped tabel · **geseed** · CRUD · **in-use-protected** (referenced value niet deletebaar →
**409 + `in_use`-vlag**) · **reorderable** (`PUT /{id}/reorder` of `/reorder {ids:[]}`). De FE leest read-only met
seed-fallback.

`candidate_phases` *(nieuw)* · `candidate_statuses` (inzetbaarheid, `requires_reason`/`requires_match`/`expects_return_date`-vlaggen) ·
`candidate_types` (contractvorm) · `funnel-types` (`requires_appointment`/`is_applicant`-vlag) · `pools` ·
`languages` · `language-levels` · `genders` · `industries` · `functions` (+`allow_free_entry`) · `driver-licenses` ✅ ·
`candidate-rejection-reasons` ✅ · `last-contact-types` · `note-types` · `document-types` (met kleur) ·
`appointment-types` · `whatsapp-message-types` (prioriteit+kleur) · `vacancy-statuses/-phases/-custom-fields` ·
`task-statuses/-types/-priorities` · `opportunity-stages` (+`is_won`/`is_lost`) · `opportunity-service-types` ·
`opportunity-agreement-types` · `planning shift-/order-/assignment-statuses` + `shift-types`.

---

## 5. Endpoint-conventies
- Lijst-response: bare array **of** `{data,meta}`; detail: bare object **of** `{data}` (consistent per resource).
- Foutcodes: **401** (auth) · **403** (policy) · **404** · **409** (`in_use` / dependency) · **422** (validatie).
- Changelog per entiteit: `GET /{resource}/{id}/activity` — append-only, `subject_*` + `causer_name` + `ip`, tenant-scoped.
- Soft-delete: `POST /{resource}/bulk/archive` (= `deleted_at`) + `GET /{resource}?include_archived=1` + `POST /{resource}/{id}/restore`.
- Bulk-mutaties reageren met `{updated}` / `{updated, skipped}` / `{archived}` (FE reconcilieert optimistisch).

---

## 6. Backlog — **volgorde van uitvoeren** (detail per taak = `worklist.md §C`)

> Werk **klein & groen per golf** (`migrate:fresh` + seed + feature-tests). Vraag bij elke echte datamodel-/shape-keuze
> **eerst Danny** om akkoord voordat je 'm vastlegt. ✅ = geleverd · ◐ = deels · ☐ = open · 🔴 = blokkeert de FE.

### P0 — Fundering (alles hangt hieraan)
- **C-0 · Volledige seeder** (Yesway + demo): alle lookups + realistische sample-data, geen lege schermen, idempotent, in `dev:reset`. ☐
- **C-10 · Assen-v2 reseed** — inzetbaarheid+blacklist ✅ (Golf ②). **Rest ☐:** `candidate_phases`-lookup + endpoint + `phase`-automation + de gedateerde Fase/Inzetbaarheid-changelog; oude `/availability-options` uitfaseren.

### P1 — Ontblokkeert de FE-afronding (audit-handoffs)
- **F-13 · Auth → httpOnly-cookieflow** (K-2): stateful-domains + CORS-credentials + `/sanctum/csrf-cookie` + `SESSION_DRIVER=redis`, één atomair window met de FE-flip. ☐
- **MOCK-1 · Planning-endpoints per kandidaat** (kandidaat-Planning-tab draait nu op dummy): `GET /candidates/{id}/shifts · …/agenda · …/open-shifts · …/favorites` (+ seed), shape = `pages/candidates/data/mocks.ts`. ☐
- **D-1 · Changelog breed** — `GET /{resource}/{id}/activity` voor customers · vacancies · applications · tasks · opportunities (candidates ✅). ☐
- **D-2 · Soft-delete breed** — applications ✅, tasks+opps ✅ (branch `feat/c29-custom-fields`, naar main mergen). Rest ☐.
- **D-3 · Archived bekijken + herstellen** — `?include_archived=1` + `/restore` + hard-delete met 409-dependency-check. ☐
- **D-4/D-5 · Tasks compleet** — `GET /tasks/stats` (server-breed) + `GET /tasks/{id}/activity`. ☐
- **F-14 · Audit-metadata "door wie + wanneer"** — notities `created_by {id,name}` + `created_at`; documenten `uploaded_by` + `uploaded_at`; + `/note-types` + `/document-types` lookups. FE toont dit al (degradeert netjes). ◐
- **CFG-1 · 3 hardcoded vocabularies → tenant-lookups** — `/nationalities`, `/languages`, klant-status-lookup (CRUD + 409 + reorder + seed). ☐

### P2 — De complete kandidaat + de andere entiteiten
- **Kandidaat compleet:** sub-entiteit body-contracten (**C-2**) · álle velden incl. `place_of_birth`/`facebook_lead_id` (**C-23**) · `last_contact_at`/`_type` + soft-delete-filters (**C-21**) · kanaal-consent `*_opt_in` + `*_consent_at` + `POST /candidates/bulk/consent` (**C-11**) · branches (**C-4**) · afspraken/intakes + `requires_appointment` + `GET /reports/intakes` (**C-22**) · voorkeuren-opslag `PATCH /candidates/{id}{preferences}` + lookups + `/note-types`/`/document-types` + `candidate_cv_template` (**C-36/C-37**) · custom fields getypeerd + verplichte-velden-per-fase + duplicate-check + merge (**C-29**).
- **Entiteiten naar blueprint:** vacatures + kandidaat-parity + `match_profiles` (**C-26/26.1/26.2**) · taken volledig + **subtaken** (**C-18/18a**) · **outreach-campagnes** (**C-18b**) · matches-tabel + `GET /matches/{id}` (linkage) + `/activity` (**C-19/D-6**) · applications seeder + `match_score` (**C-20**) · klanten + sub-entiteiten + `/activity` + `/documents` (**C-27**) · opportunities zorg-model (uren/looptijd/dienst/overeenkomst/org-hiërarchie/taken) + stage-id/`is_won`/`is_lost` + bulk + tags + notities (**C-41/C-42**).
- **Dashboard & rapporten:** `GET /dashboard` (**C-30**) · `GET /reports/flow|recruiters|intakes|vacancies|matches` (**C-34**) · charts-data (**C-31**) · `dashboard_type` op 7 rollen via `GET /auth/me` (**C-35**) · `ui_preferences` op users (**C-33**).
- **Gebruikersbeheer (C-40):** `PATCH /users/{id}` (firstname/lastname apart terug!) · `PUT /users/{id}/roles {roles:[id]}` · `GET /roles` — nu 401/500, auth-gate `tenant_admin`.
- **Workflow-graaf (C-27-workflow):** steps met `position` + `connections[]` (`{target,filters}`) + **stabiele step-`id`'s** (anders flatten Router-takken) · run-historie `GET /workflows/{id}/runs` (`step_results[]` met INPUT/OUTPUT) · token-substitutie `{{stepId.pad}}` tijdens run · filter-`field`-keys matchen datamodel (`function_title`/`owner_id`/`funnel_type`, **niet** `function`/`owner`/`funnel_stage`).
- **WhatsApp-privé wachtrij (C-43):** outbox + drain + stats ✅ geleverd. **Open:** enqueue-triggers + demo-queue + kanaalfouten (failed/retry) + `dev:reset`.

### 🔴 P2-blocker — Planning
- **C-44 · Native Planning-module** (Orders/Shifts/Assignments/Uren, 0% mock): nieuwe entiteiten + guards (spots/availability/blacklist) + afgeleide velden (`open_spots`/`total_hours`) + Settings-lookups. FE wacht hierop.

---

## 7. Contract-template (lever dit per endpoint)
```
<METHOD> /<path>            — auth + tenant-scope + policy
Request  : { … }           (snake_case; FormRequest-regels)
Response : { … } of {data} (snake_case; matcht de FE-mapper)
Errors   : 401/403/404/409/422 (409 = in_use / dependency)
Seed     : welke demo-data (Yesway + demo), idempotent
Index    : tenant_id + gefilterde kolommen
Tests    : happy path + tenant-isolatie + 4xx
```

## 8. Definition of Done + self-audit
Sluit elke taak af met een **self-audit**: tenant-scope? indexes? migratie in `create_`? Resource? geen PII-log?
409/`in_use` op lookups? seed idempotent? tests groen (happy + tenant-isolatie + 4xx)? Wees eerlijk over wat nog niet af is.

**Aanpak-volgorde:** P0 (seeder + phases-lookup/automation) → P1 (de 8 audit-handoffs — die ontblokkeren de FE nu) →
P2 per entiteit → C-44 planning.
