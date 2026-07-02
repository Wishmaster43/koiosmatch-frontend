# Dashboard-plan (B-27) — per-rol dashboards + nieuwe grafieken

> Werklijst om af te werken (niet in één keer bouwen). Elk blok = **component +
> data-need + backend-feed**. Doorklik verplicht op elke grafiek (`onNavigate(page,
> intent)`), filters zichtbaar toegepast op de doelpagina.

## Status
- ✅ Per-rol **templates** + **topbar-switcher** (dropdown, super-admin/management previewt alles; management = `'*'` = volledig dashboard, niks verborgen).
- ⚠️ **Nu verbergen de rollen alleen bestaande blokken** — de rol-specifieke *nieuwe* grafieken hieronder bestaan nog niet. Dat is de volgende bouwronde.

---

## 🟣 Management — ziet het meest (analytisch, tenant-breed)
- [ ] **Instroom ↔ Uitstroom / week** — netto pijplijn-gezondheid (gegroepeerde/divergerende bar). *Data: timeseries.in + .out.*
- [ ] **Invulgraad (fill rate)** — vervulde vs open vacatures (gauge + trend).
- [ ] **Funnel-conversie** — % drop-off per fase (applied→intake→hired), funnel met percentages.
- [ ] **Plaatsingen / maand × recruiter** — bar.
- [ ] **Time-to-fill / time-to-hire** — gem. dagen (KPI + trend).
- [ ] **Bron-effectiviteit** — source → hires (welke bronnen leveren op).
- [ ] **Kansen win/lost-ratio + pipeline-waarde per fase** — bestaande oppStage uitbreiden met waarde.
- [ ] **Bezettingsgraad** — utilization (planning-module, gated).
- [ ] **KPI's:** nieuwe intakes (week) · plaatsingen (week) · verlopen taken · pipeline-waarde.

## 🔵 Recruiter — "mijn werk" (operationeel)
- [ ] **Mijn funnel** — mijn sollicitaties per fase.
- [ ] **Mijn taken** — te laat / vandaag (lijst).
- [ ] **Mijn intakes deze week** — afspraken (mini-agenda/lijst).
- [ ] **Niet-gecontacteerd (mijn)** — op *laatste-contactdatum*.
- [ ] **Mijn conversie** — applied→hired.
- [ ] **KPI's:** mijn kandidaten · mijn open taken · mijn intakes vandaag.

## 🟢 Planner — planning-module
- [ ] **WhatsApp-wachtrij** — grootte + wachtend/gefaald (KPI + lijst). *(bestaat: `useWhatsAppQueue`)*
- [ ] **Incomplete workflow-runs** — gefaald/pending (lijst). *(bestaat: `ai_runs` met `ok=false`)*
- [ ] **Open shifts / onvervulde diensten** — telling + lijst.
- [ ] **Bezetting / dag-week** — bar.
- [ ] **Komende afspraken** — lijst.

## ⚪ Readonly
- [ ] Beperkte read-only KPI-strip + funnel (bestaand, geen nieuw werk).

---

## Doorklik & filters (alle grafieken)
- [ ] **tasks + opportunities**: `intent`-param toevoegen (worden nu genegeerd → dashboard-klik filtert niet).
- [ ] **Recente-lijst-rijen → drill-down**: `intent.open = id` → doelpagina roept z'n bestaande `selectX` aan (hergebruik, geen nieuw mechanisme). Recente kandidaat → kandidaat-drawer · recente sollicitatie → sollicitant-drawer · lead → klant-drawer · run → workflow-run · gesprek → WhatsApp.
- [ ] **Periode-klik**: datumveld-selector (**aangemaakt** / **laatste contact**) + range → lijst past `*_between` toe.
- [ ] **"Actief filter"-chiprij** bovenaan de lijst (klein gedeeld component) zodat een dashboard-sprong zichtbaar + wisbaar is.

## Settings (Fase 4)
- [ ] **Settings → Dashboards**: sub-tab per type + `ViewConfigEditor` (blok aan/uit + volgorde) + **live preview** (`<Dashboard viewType>` in een frame) + **rol → type-mapping**.
- [ ] **RolesSettings**: "Startdashboard"-dropdown per rol (`dashboard_type`, precedentie `management > recruiter > planner > readonly`).

---

## 🔧 Backend ↔ Frontend — status & eigenaarschap

> **BE = `koiosmatch-api` (deze lane), FE = `koiosmatch-frontend`.** Backend levert feed/velden; frontend wired de blokken. Sectie bijgehouden door **BE-Claude** — hou 'm in sync (identieke kopie in `koiosmatch-api/docs/DASHBOARD-PLAN.md`).

### ✅ Klaar (backend geleverd — live + groen op main, t/m `7acd261`)
- **Contact-recorder (item 1)** — gedeelde `RecordsLastContact`-trait op **kandidaten én klant-contactpersonen**, gestempeld via **model-events** (elk schrijfpad, monotoon, geen updated_at-bump):
  - Kandidaat: **notitie** → `note`, **afspraak** → `appointment` / `call` (belafspraak) / `meet` (Google Meet).
  - Contactpersoon: **klant-notitie** → de **primaire contactpersoon** (kanaal `note`).
  - Kanaal-lookup (8 slugs): `email·phone·whatsapp·whatsapp_private·appointment·call·meet·note`.
- **Datumveld-filter (item 5)** — `created_between` + `last_contact_between` op de **kandidatenlijst** (`/candidates`), positioneel én keyed shape → "periode-klik → datumveld-filter" kan nu.
- **Drill-down-ids** — `recent.applications[]` draagt `candidate_id` + `vacancy_id` (naast `id`); `recent.candidates[].id` = kandidaat, `recent.leads[].id` = klant.
- **`dashboard_type`-enum (item 6) — backend is leidend.** Echte waarden: **`admin · management · recruitment · planning · backoffice · sales · readonly`**. ⚠️ **NIET** `recruiter`/`planner` → FE gebruikt **`recruitment`** en **`planning`**. `/auth/me` geeft `roles[].dashboard_type`.
- **Item 2 — Uitstroom-timeseries** — `GET /dashboard/charts` → `timeseries.out.{candidates_out, applications_rejected, matches_ended}` + `net` (instroom − uitstroom, `[{name,value}]`). `candidates_out` = gearchiveerd (deleted_at) **OF** naar een `requires_reason`-status (via de flag). Stamps: `matches.ended_at` + `candidates.status_changed_at`.
- **Item 4 — Metrics (deel 1/2)** — nieuwe KPI's op `GET /dashboard`: `placements` · `intakes` (permissie-gated) · `wa_queue` (whatsapp-module) · `incomplete_runs` (workflows-module).
- **Item 3 — Rol-gescopte feed** — recruiter (`dashboard_type=recruitment`) of `?mine`/`?type=own|recruitment` → `owner_id=me` op álle candidate-centric queries (kpis·recent·charts·uitstroom); management/super-admin/overig = tenant-breed. `?type` narrowt alleen, wident nooit (§5, enforced op central-rol).
- **Attention-feeds (FE-review)** — `attention.{failed_workflows, tasks_overdue, expiring_opps}` op `GET /dashboard` (permissie/module-gated).

### ⏳ Eerstvolgend (backend — deblokkeert de management-grafieken)
- **Item 4 — Metrics (deel 2/2)** — fill-rate · time-to-fill · source→hires (definitie-keuze nodig) · bezettingsgraad (Dash's planning-data).
- **`escalations[]` + `expiring_opportunities[]`-lijst + `role.dashboard_type` schrijfbaar (`PUT /roles/{id}`)** — `escalations[]` wacht op bron-definitie. *(Dash: task-overdue-filter + icon-kolom + opps won/lost + notifications-feed.)*
- **Item 1 rest** — overige contact-bronnen: WhatsApp (zakelijk+privé) + e-mail; per-persoon-precisie (`customer_contact_id` op notitie/afspraak); opportunity-contact.
- **Item 5 uitbreiden** — datumfilters naar de overige lijst-endpoints.

### 🤝 Nodig van / voor de andere lanes
- **FE**: enum-slugs `recruitment`/`planning` in de topbar-switcher + rol-mapping; recente-sollicitatie-rij leest `candidate_id`/`vacancy_id`.
- **Dash (BE, zelfde repo)**: opportunity-contact als touch-bron (item 1) + evt. planning-cijfers voor bezettingsgraad (item 4) — stem ik af via Danny.

---

## 📊 Dashboard-signalen — nieuwe FE-behoeften (2026-07-02, Danny-review)

> FE heeft de doorklik-bedrading af (funnel→sollicitaties gefilterd, WhatsApp→juiste tab,
> runs→Workflows, recente-rijen drill-down). De onderstaande **blokken/KPI's staan FE-klaar
> en graceful** (tonen "—" of verbergen zich) en lichten op zodra de backend de data levert.
> Alles owner-scoped op de caller-rol; backend enforce't (§5), vertrouwt query-param niet.

### 🟥 Backend — nog te leveren (deblokkeert FE)
1. **Rol → dashboard koppelen** — `role.dashboard_type` **schrijfbaar** (bv. `PUT /roles/{id}`,
   waarde ∈ `admin·management·recruitment·backoffice·sales·planning·readonly`). `/auth/me` geeft 'm
   al read-only terug; nodig is write → dan zet FE de "Startdashboard"-dropdown in RolesSettings.
2. **Escalaties** — `GET /dashboard` → `escalations[]` (`{ id, kind, candidate_id?, subject, at }`)
   + `attention.escalations` (telling). Voor recruitment + management.
3. **Mislukte workflows** — `attention.failed_workflows` (server-brede telling) + markeer bestaande
   `ai_runs[]` met `ok:false` (FE leidt de lijst nu al af, maar de KPI-telling moet server-breed).
4. **Taken over datum** — `attention.tasks_overdue` (telling) + een **`overdue`-bucket/filter** op het
   taken-lijst-endpoint zodat de KPI-klik → Taken (overdue) filtert.
5. **Bellijsten — niet-gebelde** — `attention.calllist_uncalled` (telling) + filter op het
   call-list/outreach-endpoint. Klik → Bellijsten (niet gebeld).
6. **Management — aflopende sales-opportunities** — `attention.expiring_opps` (telling) +
   `expiring_opportunities[]` (`{ id, name, value, close_date }`), sluit binnen X dagen. Klik → Kansen.
7. **Sales win/lost** — `/opportunities/stats` → `won` · `lost` · `win_rate` (voor een sales-grafiek).
8. **Recruitment-feeds** (owner-scoped): `touchpoints[]` (`{ candidate_id, name, type:
   birthday|first_workday|back_available|followup_due, date }`) + `attention_candidates.{stale6m,
   never_contacted,no_followup}[]` (`{ id, name, status_value, last_contact_at }`).
9. **Notificatie-feed** (topbar-bell staat live, graceful) — `GET /notifications` →
   `[{ id, title, body, created_at, seen, link? }]` (per user, nieuwste eerst) + `POST /notifications/seen`
   (markeer alles gelezen). Voedt de in-app bell; welke events notificeren komt uit de bestaande
   notificatie-instellingen.
10. **Task-priority (en status/type) `icon`** — icon-kolom op de taken-lookups + toegestane iconen
    (zoals rollen: `icon` op de rij + een vaste set). Dan zet FE de icon-picker in `StatusListEditor`
    (`withIcon`). Zonder kolom slaat een gekozen icoon niet op → bewust nog niet gebouwd.

### ✅ Al bevestigd + door FE gewired
- `charts.timeseries.out.{candidates_out, applications_rejected, matches_ended}` (instroom↔uitstroom) —
  staat klaar in de weekly-chart, licht op zodra geleverd.
- Behouden top-signalen (recruitment "was juist top"): **niet-gecontacteerd >6m** (`attention.stale_6m`)
  + **nooit gecontacteerd** (`attention.never_contacted`) — al gewired als KPI's.

---

## 📣 FE-status voor Dash (2026-07-02) — FE is bij, wachten op backend

> **Alle FE-kant is klaar, gecommit en groen op main** (tsc 0 · lint 0 · i18n parity · build ✓).
> Elk blok/KPI hierboven is **gewired + graceful** — verbergt zich of toont "—" en **licht vanzelf op**
> zodra jouw feed er is. Niks breekt tot dan; jij kunt in je eigen tempo leveren.

**Wat FE al met je laatste levering deed (t/m `8328f53`):**
- `last_contact_between` → de **">6m niet gecontacteerd"-drilldown filtert nu server-breed** (was client-side).
  *(`never`/`no-followup` blijven client-side tot er een null-contact-param is — graag `has_last_contact=0` of
  vergelijkbaar als je 't makkelijk kunt meenemen.)*
- Enum (`recruitment`/`planning`), drill-down-ids, `last_contact_at` render — allemaal geconsumeerd ✓.
- **Per-rol dashboard-composities vastgezet** (FE-only, geen backend-impact): recruitment · sales ·
  backoffice tonen hun 2 verdelings-charts naast elkaar, management = alles. De definitieve block-ids
  en KPI-rijen per rol staan in `templates.ts` (`DASHBOARD_TEMPLATES` / `KPI_ROWS`) — dé referentie
  voor wat elke `?type=<rol>`-feed moet vullen.

**Waar FE nu op wacht (jouw "nog te leveren"-lijst 1–10 hierboven):** `attention.*`-tellingen ·
`charts.timeseries.out.*` · escalaties/feeds · notificatie-feed (`/notifications` + `/seen`) ·
sales `won/lost` · `role.dashboard_type` write · icon-kolom op taken-lookups.

**Geen actie van jou vereist behalve leveren** — ik verifieer per levering en meld terug via Danny.

---

## ❓ Overleg aan Dash (2026-07-02, na jouw laatste levering)

**1. Rol → dashboard koppelen (item #1 — write).** FE zet nu in **RolesSettings** een **"Startdashboard"-dropdown**
(labels = de switcher-`types.*`) en stuurt `dashboard_type` **mee in de bestaande `PUT /roles/{id}`** (naast
`color`/`icon`). Vraag: accepteert die PUT `dashboard_type` al, of moet FE een ander veld/endpoint gebruiken?
Graag write aanzetten. Multi-role-precedentie die FE hanteert: `admin > management > recruitment > backoffice >
sales > planning > readonly` (`resolveDashboardType`).

**2. Verificatie van je nieuwe leveringen (top, dank!) — bevestig de veldpaden dan wire ik ze meteen:**
- **Uitstroom + net** — je noemt `GET /dashboard/charts` → `timeseries.out.*` + `net`. FE leest de weekly-serie nu uit
  **`dash.charts.timeseries`** (van `GET /dashboard`). Staat `charts` genest op `/dashboard`, of moet FE
  **`/dashboard/charts` apart** ophalen? Bevestig → dan zet ik uitstroom-bars + een net-lijn aan.
- **Metrics deel 1** (`placements`·`intakes`·`wa_queue`·`incomplete_runs` op `GET /dashboard`) — top-level of onder
  **`attention.*`**? FE-KPI's lezen nu `attention.placements` / `attention.intake_planned` / etc. Geef het pad, dan
  sluit ik exact aan (of ik pas de KPI-reads aan).
