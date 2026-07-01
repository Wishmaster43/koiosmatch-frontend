# Koios Match — ARCHITECTURE (single source of truth)

> **Doel:** dé bron voor entiteiten, relaties, statussen/transities, cross-cutting
> systemen en het API-contract. `/architect` toetst hieraan; bevindingen + uit-te-bouwen werk
> staan in `docs/worklist.md` (§F = architectuur/kwaliteit); `CLAUDE.md` de regels.
> Dit bestand = het **model + contract**.
>
> **Punt-voor-punt afronden.** Elke regel heeft een marker:
> ✅ bevestigd (code/beslissing) · ⚠️ beslissing nodig (Danny) · ☐ nog documenteren/verifiëren ·
> 🔒 hangt op backend. Werk dit bij zodra een punt landt.
>
> **Laatst bijgewerkt:** 2026-07-01 · **§2/§3 → v2-assenmodel** (Fase + Inzetbaarheid, blacklist =
> status-waarde, availability gevouwen, geen `inactive`; AP-C1) — door FE-Claude.

---

## 0. Kernprincipe — alles is gelinkt ✅
Candidate · Opportunity · Vacancy · Application · Match · Task · Workflow · TalentPool ·
Customer → Location → Department vormen **één verbonden graaf**. Een scherm dat een entiteit
als losse tabel behandelt is fout: vanuit elke hoek moet je de gekoppelde records bereiken
en bewerken. Multi-tenant SaaS, special-category (gezondheids)data — AVG navenant.

---

## 1. Entiteiten ✅
Native (schone, prefix-loze endpoints): **candidates · applications · vacancies · matches ·
opportunities · tasks · customers · locations · departments · contacts · planning(/shifts)**.
Externe spiegels met bron-prefix: **ShiftManager `sm_*`** · **HelloFlex `hf_*`** (zie §8).

**Candidate sub-entiteiten** (genest, bron = `pages/candidates/data/mapCandidate.js`):
`experiences · educations · certifications · skills · languages · documents · pools ·
branches · applications[] · matches[] · notes · timeline`. ✅

---

## 2. De assen — **v2-model** (K-18 / C-10; code-geverifieerd 2026-07-01) ✅
**Zes assen** beschrijven één persoon, elk één vraag; nooit samenvouwen. **Bind altijd op de flag, nooit op
een key/label** (een tenant hernoemt/remapt waarden). Alle waarden = tenant-lookups.

- **Contractvorm** (was "candidate type") = **multi-value** `candidate_types` (detachering · flex · uzk ·
  zzp · payroll · oproep · freelance). *"In welke contractvorm(en)?"* Verandert zelden. ✅
- **Fase (lifecycle)** = **single**, `candidate_phases` (kolom `candidates.phase`): `lead → candidate`
  (+ later `alumni`). De `is_applicant`-fase wordt gezet op de 1e sollicitatie. ✅
- **Inzetbaarheid (status)** = **single**, `candidate_statuses` (kolom `candidates.status`, default
  `available`): `available · placed · unavailable · sick · leave · blacklist`. Gedrag is **flag-driven**:
  `requires_match` (= `placed`, vereist een gekoppelde Match) · `requires_reason` (+ `expects_return_date`
  → `available_again_date`). De oude losse **availability-as is hierin gevouwen**; er is **geen `inactive`** meer. ✅
  - **Blacklist = een status-waarde** (`status === 'blacklist'`, kleur `#DC2626`), **geen aparte kolom/vlag**.
    Reden = kolom **`blacklist_reason`** (uit een `blacklist_reasons`-lookup), gated door de setting
    `blacklist_reason_required` (default aan) — **niet** `status_reason`. ✅
  - **Archived = soft-delete** (`deleted_at`), geen status. ✅
  - **blacklist + archived = default verborgen** in lijsten (`?status[]=blacklist` / `?include_archived=1`
    tonen ze wél → KPI-totalen dalen). ✅
  - `placed` alleen met gekoppelde Match; `unavailable` alleen zonder actieve Match + (planning) geen
    toekomstige inplanning — anders blokkeren met reden. ✅
- **Funnel-fase** = **single value per sollicitatie**, `application_stages`: `applied · invited(/intake) ·
  proposal · hired · rejected`. Buckets uit de flags **`is_match`/`is_rejected`** (nooit de key). Op de
  kandidaat read-only chips; "Sollicitant" = afgeleid (≥1 lopende sollicitatie, `is_applicant`). ✅
- **Fase- én inzetbaarheid-wissels zijn gedateerd + beredeneerd** (`effective_from` + `reason`;
  "Kandidaat sinds …" / "Niet beschikbaar sinds … · reden"). Kleine change-log, aan de audit-trail. ✅

---

## 3. Fase ↔ inzetbaarheid ↔ funnel = automatisering, geen veld-koppeling ✅
Gestuurd door **automation** (geseed, instelbaar); resolve altijd via de **flag**, niet de key:
1. eerste sollicitatie → **Fase** `lead` wordt `candidate`;
2. funnel **`is_match`**-fase → maak een **Match** + zet **inzetbaarheid** `placed`;
3. **`is_rejected`** zonder andere lopende sollicitatie → Fase blijft `candidate`.
Eén persoon heeft één fase + één inzetbaarheid met meerdere sollicitaties (elk eigen funnel). ✅

**Twee paden naar een plaatsing** (entry = nieuwe Lead óf bestaande Kandidaat): ✅
- **Via funnel:** vacature → sollicitatie → funnel → `is_match` → Match → plaatsing.
- **Direct match:** `POST /matches {candidate_id, vacancy_id}` zonder funnel → plaatsing.
Beide → inzetbaarheid **`placed`**. Een Match voegt automatisch een **werkervaring** bovenaan toe.

⚠️ **Appointment-gated fasen:** een funnel-fase kan `requires_appointment` vereisen (vlag, geen
hardcoded slug). Geen geplande afspraak op zo'n fase → inconsistentie-vlag op de kandidaat.
Afspraken = aparte tenant-entiteit (`scheduled_at`/recruiter/locatie/type/status). 🔒 backend C-22.

---

## 4. Match-model (3 lagen, beslist 2026-06-21) ✅
1. **Match score** = fit (0-100% + criteria) op de **sollicitatie** (`applications.match_score` +
   `match_criteria` + `match_summary`, plat). 
2. **Match** = eigen entiteit (`matches`-tabel, `GET /matches`). **1 vacature : N matches.**
   Trigger = configureerbare eindfase-vlag op de funnel (mirror `requires_appointment`).
3. **Contract** = duur/schaal/trede/uurtarief → leeft **volledig in HelloFlex**; wij bewaren
   alléén `helloflex_contract_guid` + `contract_status` op de match. Geen eigen contract-tabel.
`MatchesTab` op de kandidaat = **read-only**. Backoffice/ShiftManager-koppeling (handmatig/bulk/
workflow) = autorisatie-gated, queue + rate-limit, mapping-fout terug op de kandidaat. 🔒 deels backend.

---

## 5. Entity-feature-blueprint ✅ (CLAUDE.md §3A)
Elke entiteit krijgt **dezelfde surface uit gedeelde delen**: `<Entity>Page` (InsightsRow + Table +
BulkBar + Add-modal + Drawer). Table = kolommen op gedeelde `DataTable`. InsightsRow = config-gedreven
(donuts + kpis, klik-tot-filter). BulkBar = thin `ActionMenu` + generieke optimistische `bulkMutate`.
Drawer = `EntityDrawer`/`EntityHeader`-shell + `DrawerTabs` (config) + één component per tab.
**Niets hardcoded** — elke optie/kleur/label komt uit een tenant-lookup via de API. ☐ uitrol per entiteit:
candidates ✅ blueprint · applications/vacancies/tasks/matches/opportunities ◐ · customers ☐.

---

## 6. Configureerbare lookups (Settings → API, nooit hardcoded) ✅
Elke lookup = tenant-scoped tabel, demo-geseed, CRUD, **in-use-protected** (409 + `in_use`),
reorderable. Frontend leest via `useX()`/`LookupsContext` met seed-fallback.
Statuses (inzetbaarheid) · **phases** · funnel-types · candidate-types · **blacklist-reasons** · pools ·
languages · language-levels · genders · industries · functions(+`allow_free_entry`) · rejection-reasons ·
last-contact-types · note-types · document-types · appointment-types · vacancy-statuses/-phases/-custom-fields ·
task-statuses/-types/-priorities · opportunity-stages/-service-types/-agreement-types · whatsapp-message-types ·
planning shift-/order-/assignment-statuses. *(availability is gevouwen in Statuses — geen aparte lookup meer.)*
☐ Volledige endpoint-tabel: zie `CLAUDE.md §3B` + worklist C-1.

---

## 7. Cross-cutting systemen

### 7.1 Workflow-modules (automation graph) ✅ / 🔒
Node-registry in `src/modules/`; per-entiteit één module via `makeEntityModule({…})` met één
**`action`**-selector (Ophalen/Aanmaken/Bijwerken/…) → secties via `showIf`. Entity-modules:
`candidates · applications · vacancies · matches · opportunities · tasks · customers · planning`. ✅
- **Filter-WAARDEN** moeten uit tenant-lookups komen (nu vrij getypt). ☐ AW (wire naar `useX`).
- **Graaf-opslag:** editor stuurt/leest per stap `position` + `connections[]` (`{target, filters}`).
  🔒 backend C-27 moet graaf + **stabiele step-`id`'s** opslaan/teruggeven (anders flatten Router-takken).
- **Workflow-engine hoort op een aparte server** (zware uitvoering, runs, logs, queues) →
  FE via configureerbare base-URL + async/queue-aware run/logs-UI. ⚠️ (memory `project-workflow-separate-server`).

### 7.2 Gedeeld filter-`field`-vocabulaire ⚠️/🔒
Backend-filter-engine (C-27) + FE-modules moeten **dezelfde field-keys** gebruiken. Nu wijken ze af:
FE `function`→data `function_title`, `owner`→`owner_id`, applications `funnel_stage`→`funnel_type`.
☐ Afspreken + uitlijnen (AW-4).

### 7.3 task_links (polymorf) 🔒
`task_links`: `task_id` + `linkable_type`/`linkable_id`, meerdere per taak. Types: kandidaat ·
sollicitatie · vacature · match · klant · locatie · afdeling · contact · workflow.
FE koos **aparte** `POST|DELETE /tasks/{id}/links` → backend bevestigen (C-18, AW-3). FE-picker
dekt nu 4/9 types (AW-5) + doet server-side search met `per_page`-cap (AW-2 ✅).

### 7.4 Tenant & pakket-model ✅
Multi-tenant (primair Yesway Flex B.V. + demo). 3 pakketten (Core/Pro/Enterprise) + losse add-ons +
connectors; super-admin schakelt modules per tenant (`accessible_pages`/`modules`). Pagina-/sidebar-
gating via `lib/access.js` (fail-open). Memories: `project-tenant-modules`, `project-pricing-model`.

### 7.5 Theming / design-tokens (light + dark) ✅
Per-tenant via CSS-vars (`useTenantTheme`). Componenten lezen **tokens**, nooit hardcoded hex.
Tokens in `src/index.css`: `:root` (light) + `[data-theme="dark"]` (dark). Neutraal
(`--bg/--surface/--border/--text/--text-muted/--hover-bg/--input-bg`) + semantisch
(`--color-{primary,secondary,success,warning,danger,info,accent}` + `*-bg`) — **beide modi gedefinieerd**
(dark `*-bg` = rgba-tinten) + `color-scheme` voor native controls. **Data-kleuren** (status/avatar/chart-
paletten, soft-chip `color+'1A'`) blijven hex. ☐ resterende ~636 hex per-touch (grotendeels data).

### 7.6 Auth & security ⚠️
Sanctum SPA. **Doel:** httpOnly cookie + CSRF (`COOKIE_AUTH`, nu OFF → token in localStorage = XSS-risk).
🔒 gecoördineerde flip met backend, dan `VITE_COOKIE_AUTH=true` (AW/CS-1). Client = untrusted; backend
her-valideert alles.

---

## 8. Endpoint-naamgeving ✅
Native = schoon/prefix-loos (`/candidates`, `/customers`, `/locations`, `/reports`, …).
Externe spiegel = bron-prefix: **ShiftManager `sm_`** (`/sm_customers`, `/sm_reports/…`),
**HelloFlex `hf_`**. Nooit een native resource prefixen; nooit een mirror een schone naam laten bezetten.
Lijst-response: bare array of `{data,meta}`; detail: bare object of `{data}`.

---

## 9. API-contract — bron van waarheid ✅/☐
**Kandidaat-velden:** `src/pages/candidates/data/mapCandidate.js` is leidend; backend levert deze
snake_case (worklist **C-23**). Sub-entiteit-bodies = worklist **C-2**. Stats/attention = **C-13**.
☐ Per entiteit het detail-shape hier samenvatten zodra bevestigd (applications C-23, vacancies C-26,
tasks C-18, dashboard C-30, charts C-31).

---

## 10. Maat & modulariteit ✅ (CLAUDE.md §3)
JSX ≤ ~250 streven · 250–400 oordeel · **> ~400 splitsen** · 1000 = harde cap. Hook/util ≤ ~150.
Single-purpose boven line-count. Backend-mirror (controller ≤150 / Service ~200–300 / Model ≤200).

---

## 11. Openstaand — punt voor punt afronden
> Detail + locaties in `docs/worklist.md` (§F architectuur/kwaliteit · §A–C feature/backend). Hier de kop-lijst:

**Beslissingen (Danny) ⚠️**
- [x] **Auth-richting besloten (Danny, 2026-06-26):** doel = **Sanctum httpOnly-cookieflow** (zie §7.6 / DECISIONS K-2). Bearer-token-in-`localStorage` = **interim** tot de gecoördineerde backend-flip (BE-8, F-13); `COOKIE_AUTH`-scaffold staat. CLAUDE.md §7 blijft de standaard.
- [x] ~~CandidatesPage hook-structuur~~ → **gesplitst 674→308** (hooks: data/options/bulk + shared) — 2026-06-25.
- [x] **Geo + planning besloten (2026-06-25):** geo (`lat/lng`+geocoding, PDOK) alleen op **native** candidates+customers; SM heeft al geo. Planning **gefaseerd**: read-only SM (`/sm_orders /sm_shifts /sm_schedule`) nu, native write-module + geo later.
- [ ] Workflow-engine aparte server: base-URL-config + async run/logs-UI inplannen (backend: runs in-DB, engine lineair/synchroon — aparte server nog niet).
- [ ] E-mail-koppeling: persoonlijk Profiel vs **Settings per context** (backend zet het op `/settings/email/{context}` — modelmismatch te beslissen).
- [ ] Terminologie "vacancy" vs "vacature+sollicitatie" (worklist A).

**Backend-geblokkeerd 🔒** — C-27 (graaf + filter-vocabulaire), C-18 (task_links-variant + search-param),
C-22 (afspraken/intakes), C-23/26/30/31 (detail-shapes/dashboard/charts).

**Frontend, open ☐**
- [ ] AW-5 LinksTab 4/9 → alle 9 koppel-types (config-gedreven).
- [ ] AW-6 WorkflowsPage `StepPill` uit de gedeelde registry (geen 2e MODULE_META).
- [ ] AW-7/8 module-labels + `CATEGORY_ORDER` → i18n + tokens (de 8 ontbrekende `modules.*`-keys).
- [ ] AW-9 `date`-veld in de editor → datepicker (DD-MM-YYYY).
- [ ] CS-4 resterende chrome-hex per-touch (data-kleuren blijven).
- [ ] CS-5 PropTypes/TS op gedeelde lagen (nu 3/277).
- [ ] CS-6 inline `api.*` → feature-`api/`-laag (72 files).
- [ ] CS-7 NL-identifiers → Engels.
- [ ] CS-9 tests op kritieke paden (nu 11; begin bij funnel-mapping + AW-2).
- [◐] RF > 400: ✅ ProfilePage · PlanningPanel · ShiftsChartsBlock · OrdersTable · LocationsPage · CandidatesPage (674→308) gesplitst (2026-06-24/25). Open: App.jsx 468 (routing, hun WIP) · ReportFilterSidebar · VacanciesPage · MessagesTable · WorkflowCanvasEditor-restant 863 (hun domein).
- [ ] §5/§6/§9 in dit doc verder invullen zodra de contracten landen.
