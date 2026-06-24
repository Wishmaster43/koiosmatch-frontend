# Backend-prompt — alle frontend-mockdata → echte API (migrations · seeders · models · resources · controllers · routes)

> **Voor:** backend-Claude (`koiosmatch-api`).
> **Door:** frontend-Claude — opgesteld 2026-06-24 uit een volledige scan van álle
> mock/dummy-data in `koiosmatch-frontend`.
> **Doel:** de frontend draait **0% mock**. Elke dataset hieronder krijgt een echte,
> tenant-scoped endpoint met een **API Resource** (vaste shape) en een **seeder** die
> de demo-data levert (de mock ÍS de seed). Daarna kan de frontend alle
> `USE_MOCKS`/`DUMMY_*`/`MOCK_*`-fallbacks verwijderen.

---

## 0. Harde regels (niet onderhandelbaar)

1. **Migratie-conventie:** **NOOIT** een `add_*` / `alter_*` / `change_*`-migratie. Vouw elke
   kolom in de bestaande `create_<table>`-migratie. Een **nieuw** migratiebestand = **alleen**
   voor een **nieuwe tabel**. Toepassen via `migrate:fresh` / `php artisan dev:reset` (pre-release).
2. **Multi-tenant:** elke tabel `tenant_id`, alle queries tenant-scoped (global scope / policy).
   Nooit cross-tenant lekken. Data is **special-category (gezondheid)** — AVG/GDPR.
3. **Endpoint-naming (CLAUDE.md §10):** native Koios = **schoon** (`/candidates`, `/customers`,
   `/locations`, `/contacts`, `/departments`, `/vacancies`, `/applications`, `/tasks`, `/workflows`).
   Externe spiegels = prefix: **ShiftManager → `sm_`** (`/sm_customers`, `/sm_candidates`,
   `/sm_reports/…`), **HelloFlex → `hf_`**. Nooit een native resource prefixen, nooit een spiegel
   op een schone naam.
4. **API Resource per entiteit** = de enige bron van de JSON-shape. Frontend leunt erop; geen losse
   velden bijverzinnen. Lijst-endpoints: `{ data: [...], meta: { … } }` (paginatie) — frontend
   leest `r.data.data ?? r.data`.
5. **Controlled vocabularies = lookup-tabellen, niet hardcoded** (CLAUDE.md §3B): statuses, funnel-fases,
   candidate-types, rejection-reasons, talen/niveaus, genders, functies, pools, last-contact-types,
   note-types. Tenant-scoped, **geseed met demo-defaults**, **in-use-protected** (409 + `in_use`),
   **reorderable**. De Nederlandse labels in de mocks zijn **lookup-waarden** (data), niet i18n.
6. **Soft-delete** voor kandidaten (en entiteiten met historie). Hard delete = backend-only, alleen
   als niets meer hangt. Respecteer geanonimiseerde/gewiste staat — nooit teruggeven.
7. **Geen PII in logs.** Identifiers = kandidaat-**UUID** (`id`), nooit ShiftManager `external_id`
   als interne sleutel.
8. **Size-discipline (CLAUDE.md §3):** controller ≤ ~150 (thin: receive → delegate → Resource),
   Service/Action ~200–300, Model/Resource/Request ≤ ~200.

---

## 1. Overzicht — wat bestaat, wat ontbreekt

| # | Domein | Endpoint(s) | Status frontend | Actie backend |
|---|---|---|---|---|
| A1 | Candidates (native) | `/candidates`, `/candidates/stats`, `/candidates/{id}`, bulk, pools | `DUMMY_CANDIDATES` fallback | verifieer shape + stats |
| A2 | Applications (native) | `/applications`, `/applications/stats`, `/applications/{id}`, `/{id}/reject`, PATCH | `MOCK_APPLICATIONS`+`buildMockDetail` | **detail-shape bouwen** |
| A3 | Vacancies (native) | `/vacancies`, `/vacancies/stats`, `/vacancies/{id}`, bulk | mock-fallback | verifieer |
| A4 | Tasks (native) | `/tasks`, `/tasks/{id}`, comments, links | **geen mock** (al echt) | verifieer links-contract |
| A5 | Customers (native) | `/customers` | via vacancies | verifieer |
| A6 | Locations (native) | `/locations` | kandidaat-filter | verifieer |
| A7 | Workflows | `/workflows`, `/workflow-folders`, `/{id}/run`/`/execute` | `MOCK_WORKFLOWS` | verifieer + graaf-opslag (C-27) |
| A8 | Rejection reasons (lookup) | `/candidate-rejection-reasons` | `MOCK_REJECTION_REASONS` | lookup-CRUD + seed |
| B1 | SM Customers (mirror) | `/sm_customers` (nested locations→departments, contacts) | `DUMMY_CUSTOMERS` | verifieer nested-shape |
| B2 | SM Candidates (mirror) | `/sm_candidates` | dashboard | verifieer |
| B3 | SM Reports | `/sm_reports/shifts-per-month`, `…/shifts-filter-options`, `…/detail` | werkt (charts) | verifieer |
| **C1** | **Contacts** | **`/sm_contacts`** *(of `/contacts` — zie §6 beslissing)* | **100% dummy, GEEN endpoint** | **NIEUW** |
| **C2** | **SM Locations (flat)** | **`/sm_locations`** | nu client-side geplat uit `/sm_customers` | **NIEUW (aanrader)** |
| **C3** | **SM Departments (flat)** | **`/sm_departments`** | nu client-side geplat uit `/sm_customers` | **NIEUW (aanrader)** |
| **C4** | **Planning / Shifts-module** | `/planning/*` of `/shifts/*` (zie §7) | AGENDA/ROSTER/OPEN_SHIFTS/FAV = 100% dummy | **NIEUW (groot, eigen module)** |
| **C5** | **Dashboard-KPIs** | **`/sm_reports/dashboard`** | `DUMMY_STATS` | **NIEUW** |
| **C6** | **Workflow run-logs** | `/workflow-runs` (workflow-server, async) | `RUNS` + `MOCK_LOGS` | **NIEUW (workflow-server)** |

> A-rijen bestaan waarschijnlijk al — **bevestig de exacte Resource-shape** tegen de
> velden hieronder. C-rijen zijn **echt missend**. B-rijen: bevestig de nested vorm.

---

## 2. Native kern-entiteiten (A)

### A1 · Candidates — `/candidates`
Velden die de frontend rendert (uit `DUMMY_CANDIDATES` + `mapCandidate`). UUID `id`.

| Veld | Type | Opmerking |
|---|---|---|
| `id` | uuid | interne sleutel (nooit SM external_id) |
| `first_name`, `last_name` | string | frontend toont `name` = samengesteld |
| `function_title` | string | lookup `/functions` (free-entry toggle) |
| `candidate_types[]` | string[] | **multi**, lookup `/candidate-types` (on_call/freelance/payroll/…) |
| `status` | enum(lookup) | `lead·candidate·matched·inactive·unplaceable` (lookup `/statuses`) |
| `blacklisted` | bool | **apart van status** |
| `funnel_*` | — | **niet** op kandidaat (alleen op application) — read-only chips afgeleid |
| `owner_id` | uuid | recruiter; Resource geeft `owner{ name, initials }` |
| `city`, `province`, `address`, `place_of_birth` | string | adres |
| `lat`, `lng` | float | **geo** — voor radius-filter (35 km) |
| `email`, `phone` | string | |
| `gender` | enum(lookup `/genders`) | + avatar-kleur |
| `nationality` | string(lookup) | VOC — zie §5 |
| `date_of_birth` | date | render DD-MM-YYYY |
| `last_contact_at` | datetime\|null | **leeg = nooit contact** → UI toont blanco, nooit "nooit" |
| `last_contact_type` | enum(lookup `/last-contact-types`) | Email/Phone/WhatsApp |
| `facebook_lead_id` | string\|null | tonen in tabel+drawer indien aanwezig |
| `summary` | text | profieltekst |
| `tags[]` | string[] | |
| `branches[]` | string[] | entiteit-werkmaatschappijen |
| `experiences[]` | obj[] | `{id,title,company,location,period,desc}` newest-first |
| `educations[]` | obj[] | `{id,title,school,period}` |
| `languages[]` | obj[] | `{id,language,spoken,written}` lookups `/languages`+`/language-levels` |
| `certifications[]`, `skills[]` | [] / string[] | |
| `documents[]` | obj[] | `{name,size}` |
| `applications[]` | obj[] | gekoppelde sollicitaties |
| `notes[]` | obj[] | `{author,created_at,text,type?}` lookup `/note-types` |
| `pools[]` | obj[] | lookup `/pools` |
| `created_at` | datetime | |
| `deleted_at` | datetime\|null | soft-delete |

- **`GET /candidates/stats`** (server-wide, niet page): `by_status`, `by_funnel` (elk
  `{key,label,color,count}`), `by_recruiter`, `not_contacted_6m`, `never_contacted`,
  `no_follow_up`, `intake_planned`, `active_conversations`, `tasks_linked`. Inactief/blacklist/
  archived **default uit** in filters (tellingen dalen mee).
- **Bulk:** `POST /candidates/bulk/{archive|notes|tags/remove}`, pools
  `POST|DELETE /pools/{id}/candidates` — body `{ candidate_ids[], … }`, response `{ updated[], skipped[] }`.
- **Status-transitie-regels** (workflow, niet hardcoded): zie CLAUDE.md §3B (Matched↔Match,
  Inactive guard, effective_from + reason changelog). `/candidates/{id}/activity` voor changelog.

### A2 · Applications — `/applications` (detail-shape ontbreekt)
Lijst-velden (`MOCK_APPLICATIONS`): `id`, `candidate_id`, `candidate{name,initials}`,
`vacancy_id`, `vacancy{title,client}`, `score` (int\|null), `task` (string), `funnel_type`
(`applied·invited·proposed·hired·rejected` — lookup, **flat** `funnel_type`+`funnel_label`+
`funnel_color`), `bucket` (afgeleid: hired→matched, rejected→rejected, rest→active), `source`,
`owner{name,initials}`, `candidate_status{label,color}`, `created_at`, `is_new` (bool).

**`GET /applications/{id}` detail** (de drawer-tabs — `buildMockDetail`), genest:
- `candidate{ name, initials, function, status{label,color}, gender, nationality, dob, email, phone, address, summary }`
- `vacancy{ id, title, client, vacancy_number, status, employment_type, location, salary, hours, experience, seniority, education, branch, category, skills[], tags[] }`
- `interviews[]{ id, channel, status, date, time, summary, transcript[]{author,side,time,text} }`
- `appointments[]{ id, type, title, when, with, status }` — **gestructureerde entiteit** (zie §3B intake)
- `timeline[]{ id, author, initials, description, ai(bool), time }`
- `notes[]`, `match_criteria[]{ key,label,score,weight,hard(bool),note }`, `match_summary`,
  `match_source`, `ai_score`, `ai{ advice(reject/review/proceed), advice_reason, auto_reject_eligible, task }`,
  `rejection{ reason_label, note, channel, sent_at } | null`
- **`POST /applications/{id}/reject`** body `{ reason_id, note, channel }`; **`PATCH /applications/{id}`**
  (funnel-fase wijzigen → workflow side-effects).
- **`GET /applications/stats`**: buckets (active/matched/rejected) + per funnel-fase.

### A3 · Vacancies — `/vacancies`
`GET /vacancies` (+`/stats`, `/{id}`), `PATCH /vacancies/{id}`, bulk
`POST /vacancies/bulk/{archive|notes|tags/remove}` (body `{ vacancy_ids[], … }`). Velden uit
`VACANCIES` + detail in A2: `id, title, client/customer_id, vacancy_number, status (lookup
/vacancy-statuses), phase (/vacancy-phases), employment_type, location, salary, hours, experience,
seniority, education, branch (industry-lookup), category, skills[], tags[], custom_fields`.
404 op lege lijst is OK (frontend behandelt het).

### A4 · Tasks — `/tasks` (links-contract bevestigen)
Al echt (geen mock). `GET /tasks`, `/tasks/{id}`, `POST /tasks/{id}/comments {body}`,
`POST|DELETE /tasks/{id}/links { type, id }`. **Links-types** die de frontend koppelt (AW-5):
candidate · vacancy · application · customer · location · department · contact · match · workflow.
Elke type heeft een zoek-endpoint (`GET /{resource}?search=&per_page=`). Zie ook C-18.

### A5/A6 · Customers + Locations (native) — `/customers`, `/locations`
`/customers` (vacancy-koppeling), `/locations` (kandidaat-radius-filter, dus **`lat`/`lng`**).
Bevestig dat dit native Koios-resources zijn (niet de SM-spiegel).

### A7 · Workflows — `/workflows`
`GET /workflows`, `/workflow-folders`; `POST /workflows`, `/workflow-folders {name}`;
`PUT /workflows/{id}`; `POST /workflows/{id}/run` (fallback `/execute`); `DELETE /workflow-folders/{id}`.
**Graaf-opslag (C-27, kritisch):** per stap `{ position{x,y}, connections[]{ target, filters } }`;
stap-`id`s **stabiel** over save/reload (anders klappen Router-branches dicht). Filter-`field`-keys =
backend-vocabulaire (`function_title`, `owner_id`, `funnel_type` — niet `function`/`owner`).
Workflow draait op **aparte server** (engine/runs/logs/queues) — zie C6 + memory.

### A8 · Rejection reasons (lookup) — `/candidate-rejection-reasons`
Seed (`MOCK_REJECTION_REASONS`): Niet flexibel genoeg · Geen match op soft skills · Niet het juiste
diploma · Reisafstand · Kandidaat geen interesse · Kandidaat trekt zich terug · Overig. Velden
`{ id, name, color, order, in_use }`. Standaard lookup-CRUD (reorderable, in-use-protected).

---

## 3. ShiftManager-spiegel (B) — `sm_`-prefix, read-only extern

### B1 · `/sm_customers` (nested)
Frontend platslaat nu zelf locations→departments + telt contacts. Shape (`DUMMY_CUSTOMERS`):
`{ id, name, debtor_number, status (actief/prospect/inactief), account_manager, city,
locations[]{ id, name, address, city, phone, email, status, departments[]{ id, name }, shift_count },
contacts[]{ … } }`. Paginatie `?page=&per_page=`.

### B2 · `/sm_candidates`
Dashboard leest `?per_page=`. Bevestig shape (zelfde kern als A1, maar **read-only mirror** met
`external_id`).

### B3 · `/sm_reports/*` (werkt al — bevestigen)
`/sm_reports/shifts-per-month?years[]=&months[]=&job_type[]=&location_id[]=&department_id[]=&candidate_id[]=`
→ rows `{ maand: "YYYY-MM", totaal, niet_ingevuld, geen_kandidaat, prognose, werkelijk (+ _uren) }`.
`/sm_reports/shifts-filter-options` → `{ job_types[], locations[]{id,name,customer} }`.
`/sm_reports/shifts-per-month/detail?…` → drill-down rijen.

---

## 4. Echt ontbrekende endpoints (C) — bouwen

### C1 · Contacts — `/sm_contacts` *(beslissing §6)*
`ContactsPage` is **100% dummy, geen enkele api-call**. Velden (`DUMMY`):
`{ id, first_name, last_name, function_title, customer_id (+customer naam), location_id (+location naam),
email, mobile, planning (bool — "ontvangt planning") }`. Tenant-scoped, paginatie, zoek
(`?search=`), filter op customer/location. Seed = de 13 demo-contacten.

### C2 · `/sm_locations` (flat) — aanrader
`LocationsPage` plat nu `/sm_customers`. Lever een **platte** lijst:
`{ id, name, customer_id (+customer), city, address, phone, email, status (active/inactive),
departments[]{id,name}, shift_count, lat, lng }`. Filters: status · customer · city. Seed = de 12 demo-locaties.

### C3 · `/sm_departments` (flat) — aanrader
`DepartmentsPage` plat nu `/sm_customers`. Plat:
`{ id, name, customer_id (+customer), location_id (+location), city, status, employee_count, shift_count }`.

### C4 · Planning / Shifts-module — `/planning/*` of `/shifts/*` *(beslissing §7)*
Kandidaat-drawer planning-tab + (toekomstige) `PlanningPage` zijn 100% dummy. Vier datasets:
- **Roster / ingeroosterd** (`DUMMY_SHIFTS_LIST`): `{ id, date, start, end, candidate_id, customer/client,
  function, location, address, color, worked_before (int), favorite (bool), remarks }`.
- **Agenda** (`AGENDA_SHIFTS`): zelfde, voor de beschikbaarheids-kalender.
- **Open diensten** (`DUMMY_OPEN_SHIFTS`): `{ id, date, time, customer/client, function, level (1-7),
  location, distance (km, uit geo), pool, shift_type (Dag/Avond/Nacht), department, open_spots, color }`.
  Filtert op afstand (geo!), niveau, shift_type → vereist kandidaat-`lat/lng` + locatie-`lat/lng`.
- **Favoriet/blacklist-zoek** (`FAV_SEARCH_DATA`): zoek over customers · locations · departments →
  is gewoon zoek op C1/C2/C3, geen aparte tabel. Favorieten/blacklist per kandidaat opslaan:
  `candidate_planning_prefs{ candidate_id, favorites{clients[],locations[],departments[]},
  blacklist{clients[],locations[],departments[]} }`.
- **Acties:** dienst inroosteren/uitroosteren op kandidaat. Dit is een **eigen module** (zwaar) —
  bevestig scope vóór bouw.

### C5 · Dashboard-KPIs — `/sm_reports/dashboard`
`DUMMY_STATS`: `{ open_hours, hours_this_month, occupancy_pct, messages_sent, response_rate_pct }`
+ vergelijk-deltas (vorige maand / historisch gemiddelde). Tenant-scoped.

### C6 · Workflow run-logs — `/workflow-runs` (workflow-server, async)
Dashboard `RUNS` + `MOCK_LOGS`: `{ id, workflow_id, name, started_at, status (ok/failed),
processed_count, error }`. Hoort bij de **aparte workflow-server** (engine/runs/logs/queues) —
async/queue-aware. Zie memory `project_workflow_separate_server` + DS-4.

---

## 5. Vocabularies → lookups (VOC) — geen hardcoded lijsten

Maak/bevestig deze lookup-tabellen (tenant-scoped, seed, reorderable, in-use-protected) — de
mock-waarden zijn de seed-defaults:
- `/statuses` (lead·candidate·matched·inactive·unplaceable) · `/funnel-types`
  (applied·invited·proposed·hired·rejected, met `requires_appointment` + `is_applicant` flags) ·
  `/candidate-types` (on_call·freelance·payroll·temp_agency·secondment) · `/genders` ·
  `/functions` (`allow_free_entry`) · `/languages` · `/language-levels` · `/pools` ·
  `/note-types` · `/last-contact-types` (Email·Phone·WhatsApp) · `/candidate-rejection-reasons` ·
  `/industries` · `/availability-options` · vacancy: `/vacancy-statuses`·`/vacancy-phases`·`/vacancy-custom-fields`.
- **`NATIONALITIES`** (VOC-1) staat nu hardcoded in de frontend → lookup `/nationalities`.

---

## 6. Open beslissing — Contacts naming
`ContactsPage` staat onder de **Shiftmanager**-sidebar. Twee opties:
- **`/sm_contacts`** — als het SM-spiegeldata is (read-only, `external_id`). *(waarschijnlijk dit)*
- **`/contacts`** — als het een native Koios-entiteit is die ook handmatig beheerd wordt.

→ **Danny/​backend kiest.** Frontend volgt. (Idem of Locations/Departments een eigen `sm_`-endpoint
krijgen (C2/C3, aanrader) of genest in `/sm_customers` blijven.)

## 7. Open beslissing — Planning-module scope
De planning-tab (C4) is de grootste missende brok en raakt geo (radius), beschikbaarheid en
inroostering. Bevestig: **eigen module nu bouwen**, of eerst alleen lees-endpoints (roster + open
diensten) en inroosteren later?

---

## 8. Definition of Done (per entiteit)

- [ ] Migratie: kolommen in `create_<table>` (geen `add_*`); `tenant_id`; FK's; `deleted_at` waar nodig.
- [ ] Model: relaties, tenant-scope, casts; geen god-model (≤ ~200 r.).
- [ ] API Resource: exacte shape uit dit document; geen PII die de UI niet nodig heeft.
- [ ] Controller: thin (≤ ~150), logica in Service/Action.
- [ ] Form Request: validatie (server is autoriteit; client-validatie is alleen UX).
- [ ] Routes: juiste naming (native schoon / `sm_` / `hf_`), tenant-middleware, policy/authorisatie.
- [ ] Seeder: de mock-data als demo-seed; lookups met defaults; `migrate:fresh` draait schoon.
- [ ] Lijst = `{ data, meta }`; stats server-wide; lege/foutieve call → lege staat (nooit verzonnen rijen).
- [ ] Pint + PHPStan + Pest groen (zie `docs/backend-quality-check-prompt.md`).

> **Terugkoppeling aan frontend:** geef per entiteit door **welke endpoints live zijn**. Dan
> verwijder ik de bijbehorende `USE_MOCKS`/`DUMMY_*`/`MOCK_*`-fallback (worklist DS-3) zodat de
> frontend op 0% mock staat. Lever bij voorkeur **één entiteit tegelijk** zodat we per stuk kunnen
> verifiëren.
