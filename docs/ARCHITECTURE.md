# Koios Match — ARCHITECTURE (single source of truth)

> **Doel:** dé bron voor entiteiten, relaties, statussen/transities, cross-cutting
> systemen en het API-contract. `/architect` toetst hieraan; `docs/architect-Worklist.md`
> bevat de bevindingen; `docs/worklist.md` het uit-te-bouwen werk; `CLAUDE.md` de regels.
> Dit bestand = het **model + contract**.
>
> **Punt-voor-punt afronden.** Elke regel heeft een marker:
> ✅ bevestigd (code/beslissing) · ⚠️ beslissing nodig (Danny) · ☐ nog documenteren/verifiëren ·
> 🔒 hangt op backend. Werk dit bij zodra een punt landt.
>
> **Laatst bijgewerkt:** 2026-06-25 · door architect-Claude.

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

## 2. De assen — bevestigd model (decision 14–16) ✅
Drie lookups + availability beschrijven één persoon; ze nooit samenvouwen.

- **Candidate type** = contractvorm, **multi-value** (oproepkracht · ZZP · payroll · uitzend ·
  detachering · demand). *"In welke contractvorm(en)?"* Verandert zelden. ✅
- **Status (persoon-lifecycle)** = **single value**, seed (`LookupsContext.DEFAULT_STATUSES`):
  `lead · candidate · matched · inactive · unplaceable`. ✅
  - **Blacklist = aparte vlag** (orthogonaal, niet in de status-lijst). ✅
  - **Archived = soft-delete-staat** (`deleted_at`), geen status. ✅
  - **unplaceable** draagt een "weer-beschikbaar"-datum → re-activatie-workflow. ✅
  - **matched** wordt gezet door de hired→match-automatisering; matched zonder Match = data-fout. ✅
  - inactive/blacklist/archived = **default uit in filters** (wel zoekbaar → KPI-totalen dalen). ✅
  - inactive vereist een **reden**; alleen toegestaan als **geen actieve Match** + (planning-module)
    **geen toekomstige inplanning**. ✅
- **Funnel-fase** = **single value per sollicitatie**, seed (`DEFAULT_FUNNEL_TYPES`):
  `applied · invited(/intake) · proposal · hired · rejected`. Bewerkbaar op de sollicitatie;
  op de kandidaat alleen read-only chips. "Sollicitant" = afgeleid (≥1 lopende sollicitatie). ✅
- **Availability** (Available/Sick/Leave) = **aparte as**, `/availability-options`. ✅
- **Status- en availability-wissels zijn gedateerd + beredeneerd** (`effective_from` + `reason`;
  "Inactief sinds …"). Kleine change-log, gekoppeld aan de audit-trail. ✅

---

## 3. Status ↔ funnel = automatisering, geen veld-koppeling ✅
Gestuurd door **workflow-automation** (geseed, instelbaar), niet door een opgeslagen status↔funnel-koppeling:
1. eerste sollicitatie → `lead` wordt `candidate`;
2. funnel **hired** → maak een **Match** + zet status **matched**;
3. **rejected** zonder andere lopende sollicitatie → blijft `candidate`.
Een persoon kan één status hebben met meerdere sollicitaties (elk eigen funnel). ✅

**Twee paden naar een plaatsing** (entry = nieuwe Lead óf bestaande Kandidaat): ✅
- **Via funnel:** vacature → sollicitatie → funnel → hired → Match → plaatsing.
- **Direct match:** Match zonder funnel → plaatsing.
Beide → status `matched`. Een Match voegt automatisch een **werkervaring** bovenaan toe.

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
Statuses · funnel-types · candidate-types · availability · pools · languages · language-levels ·
genders · industries · functions(+`allow_free_entry`) · rejection-reasons · last-contact-types ·
note-types · vacancy-statuses/-phases/-custom-fields · task-statuses/-types/-priorities.
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
> Detail + locaties in `docs/architect-Worklist.md` (AW/CS/RF). Hier de kop-lijst:

**Beslissingen (Danny) ⚠️**
- [x] ~~Auth: httpOnly-cookie~~ → backend koos **Bearer-token** (Authorization-header), géén SPA-cookieflow (2026-06-25). CLAUDE.md §7 her-evalueren als security-traject.
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
