# Koios Match — Architect-Worklist (data-coherentie & architectuur)

> **De architectuur-lens op de werklijst.** Dit bestand bevat de bevindingen van
> `/architect` (front-end data-/solution-architect): contract-alignment, entiteit-
> koppeling, configureerbaarheid, modulariteit. Het is **geen tweede bron van open
> taken** — elk actiepunt verwijst naar het bijbehorende **B-** (frontend) of **C-**
> (backend) item in [`docs/worklist.md`](worklist.md), dat de enige bron blijft.
> Hier staat het *waarom het samenhangt*, daar staat het *wat te bouwen*.
>
> **Laatst bijgewerkt:** 2026-06-24 · door architect-Claude.
> **Legenda:** ☐ open · ◐ deels / wacht op backend · ✅ opgelost · 🔒 geblokkeerd op backend
>
> **Samenwerkings-afspraak (2 Claudes parallel, besloten 2026-06-24):** ik (refactor-Claude)
> pak **alleen bestanden die NIET in de WIP van de andere Claude staan** (`git status`
> vóór elke edit checken) — zo kan niemands ongecommitte werk overschreven worden. De
> overlap-bestanden (hun actieve domein: candidates · entities vacancies/customers/matches/
> opportunities/applications/tasks · reports · workflow-editor · settings/registry+AuditLog ·
> i18n-locales) doen **zij of later** als hun status schoon is. Mijn veilige domein:
> shiftmanager · auth · whatsapp · dashboard · app-shell/layout (excl. workflow) · components/ui
> (excl. DataTable). **Geen handoff/domein-split** afgesproken — puur "veilige files first".
>
> **Bron van waarheid:** `docs/ARCHITECTURE.md` bestaat (2026-06-23, P-1 ✅) als bron-van-waarheid. Aanvullend
> leven het entiteit-/relatie-model en het API-contract verspreid over `worklist.md`
> (C-secties), `CLAUDE.md` §3A/§3B/§10 en de memories.

---

## ▶️ OPEN — afwerklijst (uitvoervolgorde)
> Alle open architect-issues, in volgorde. Detail per item in de secties hieronder (AW/CS/RF/DS/DUP/VOC).
> Marker: ☐ open · ◐ deels · ⚠️ jouw input · 🔒 backend.

**Solo (samen afwerken — frontend, geen backend/beslissing nodig):**
1. ✅ **DUP-3 — geen duplicate (re-scan 2026-06-24).** De twee `LANGUAGES` zijn verschillende concepten:
   `CompanySettings` = bedrijfs-communicatietaal (tenant-setting → hoort bij VOC-2), `ProfilePage` = de
   app-taalschakelaar = de 5 i18n-locales (app-structuur, OK hardcoded). Niets te consolideren.
2. ☐ **i18n-eilandjes dichten.** `AddShiftModal` (7) · `MonthlyKpiCard` (3) · `LineChartCard` (2) → alles via `t()`.
3. ◐ **DUP-1 — echte duplicate-selects opgeruimd (re-scan 2026-06-24).** `BranchSection` → `SearchSelect` (multi),
   `AddApplicationModal SearchField` → `CreatableSelect` (single). **De "9" was opgeblazen:** de rest is **geen**
   duplicate-select — `SettingsControls`/`UsersPage` = kleur-pickers · `KoiosSteps`/`MatchScoreBlock` = uitklap-toggles ·
   `EntityHeader`/`KoiosModelPicker` = custom meta-pickers (avatars/model-rendering). Niets meer te swappen.
4. ☐ **i18n shiftmanager-pagina's** (Locations/Contacts/Departments, ~22 strings, 0×`t()`) → volledig vertalen.
5. ☐ **CS-7 rest — NL-identifiers** die nog verspreid staan (buiten candidate-drawer al gedaan).
6. ◐ **RF — 419–469-band** (~9 bestanden net > 400) splitsen, one-touch/marginaal.
   - ✅ **gedaan 2026-06-24:** ProfilePage 421→172 · PlanningPanel 419→79 · ShiftsChartsBlock 468→141.
   - ☐ **veilig voor mij (mijn domein, buiten hun WIP):** `LocationsPage` 441 · `OrdersTable` 428 (beide shiftmanager).
   - ⚠️ **App.jsx** 468 — buiten WIP maar routing/providers; de andere Claude voegt net routes toe → conflictrisico, alleen pakken als hun status schoon blijft.
   - 🤝 **uitgesteld (hun domein/WIP):** `ReportFilterSidebar` 469 · `VacanciesPage` 424 · `MessagesTable` 423 (reports).
7. ☐ **Editor-i18n-pass (AW-7/AW-8 + AW editor-strings).** Workflow-editor (~60 strings, 0×`t()`) + module-registry labels/categorieën + `CATEGORY_ORDER` → keys. *(groot, ~1–2 dagen, maar solo)*
8. ☐ **CS-4 rest — chrome-hex** die per-touch meelift (data-kleuren blijven).
9. ☐ **DUP-2 — select-componenten documenteren** (wanneer `SearchSelect`/`SelectMenu`/`CreatableSelect`/`SelectField`) zodat niemand een 5e bouwt.

**Wacht op verificatie/afstemming (jouw input / backend):**
10. ⚠️ **API-status invullen** (welke endpoints live) → **DS-3: mock-fallbacks eruit** (`DUMMY_CANDIDATES`/`MOCK_WORKFLOWS`/`USE_MOCKS` → lege staat). → **Backend-prompt klaar (2026-06-24):** [`docs/backend-mockdata-to-api-prompt.md`](backend-mockdata-to-api-prompt.md) — volledige mock-inventaris met endpoints/velden/seed; backend bouwt, koppelt per entiteit terug welke live zijn, dan sloop ik de fallback.
11. ⚠️ **DS-1/DS-2 — PlanningPage + ContactsPage** (0 api-calls, 100% dummy): welk endpoint? (`/planning`/`/shifts` · `/sm_*`).
12. 🔒 **VOC-1/2/3 + DUP-4 — vocab → lookups** (`NATIONALITIES` · CompanySettings-lijsten · SM-statussen) — vereist backend-lookups.
13. 🔒 **AW-1/3/4 — graaf-opslag · links-contract · filter-vocabulaire** (backend C-27/C-18).
14. 🔒 **CS-1 — auth httpOnly-cookie-flip** (gecoördineerd met backend).
15. ⚠️ **CandidatesPage (670) + WorkflowCanvasEditor-restant (863)** — jouw hook-/architectuur-input nodig.
16. ⚠️ **CS-5/6/9 — PropTypes · inline-api→`api/`-laag · tests** (dagen elk; apart inplannen).
17. 🔒 **DS-4 — `MOCK_LOGS`** → echte run-logs-feed (workflow-server).

---

## Review 2026-06-23 — niet-gecommitte wijzigingen
**Scope:** workflow-modules rename (`src/modules/` + `makeEntityModule`) · Taken/LinksTab ·
kandidaat-drawer token-migratie · WorkflowCanvasEditor graaf-opslag.
**Verdict:** **NOT COHERENT** (1 BLOCKER + meerdere CRITICALs). De richting (factory +
graaf-serialisatie) is vooruit-correct; de frontend leunt op nog-niet-bevestigde backend-data.

### 🔒 BLOCKER
- [ ] **AW-1 · Graaf-opslag hangt op C-27.** De editor stuurt/leest nu per stap
  `position` + `connections[]` (`{target, filters}`), maar de backend bewaart alleen `order`
  en houdt step-`id`'s niet stabiel → bij herladen vallen Router-takken + verbindingsfilters
  weg. FE-helft is klaar; **niet verder bouwen** tot backend de graaf opslaat/teruggeeft met
  stabiele id's. *(file: `WorkflowCanvasEditor.jsx:316-362`; backend = worklist C-27.)*

### ☐ CRITICAL
- [◐] **AW-2 · LinksTab — FE-fix GEBOUWD 2026-06-23.** `SearchSelect` kreeg een optionele
  `onSearch`-prop (debounced, skip client-filter); `AddLinkRow` fetcht nu `{ search, per_page: 25 }`
  i.p.v. de hele tabel → geen volledige special-category-lijst meer in de client (§8/§9). Build+lint groen.
  **Rest = backend:** `search`-param op `/candidates|/customers|/contacts|/vacancies` (anders cap-only).
- [ ] **AW-3 · `/tasks/{id}/links`-variant niet bevestigd.** C-18 laat de keuze open
  (body-embedded vs aparte `POST|DELETE`); FE koos eenzijdig de aparte endpoints met silent
  `catch`. Implementeert backend de body-variant → koppelen no-op't stil. → backend bevestigt
  de aparte-endpoint-variant; FE vervangt silent `catch` door revert+melding.
  *(file: `TasksPage.jsx` handleAddLink/RemoveLink; backend = C-18 r.831-832.)*
- [ ] **AW-4 · Filter-`field`-keys wijken af van het datamodel.** Modules sturen `function`
  (data `function_title`), `owner` (`owner_id`), `pool` (`pools[]`), applications `funnel_stage`
  (`funnel_type`). De backend-filter-engine (C-27) moet deze kennen, anders falen filters stil.
  → één gedeeld filter-vocabulaire afspreken + FE-keys uitlijnen. *(files: `candidates.js:18-29`,
  `applications.js`; backend = C-27.)*

### ☐ HIGH
- [✅] **AW-5 · LinksTab dekt nu alle 9 koppel-types** (2026-06-23). `TYPE_ENDPOINTS` uitgebreid met
  application/match/location/department/workflow (i18n-keys bestonden al). *(Server-side search/cap via AW-2;
  filtert pas server-side als de backend `?search=` levert.)*
- [✅] **AW-6 · WorkflowCard/StepPill voedt nu uit de gedeelde `MODULE_META` (`@/modules/index`)** (2026-06-23); de lokale 6-type-map is weg, alle module-types renderen. i18n-label valt terug op de registry-label.
- [◐] **AW-7 · Module-labels i18n — zichtbare chips GEDAAN 2026-06-23.** De **WorkflowsPage-kaart-chips**
  (StepPill, via AW-6 `t('modules.*')`) vertalen nu: entity-module-keys (applications/vacancies/matches/
  opportunities/tasks/customers) toegevoegd in nl+en. **Rest = grotere taak:** de **workflow-editor**
  (ModulePicker/ConfigPanel) gebruikt **nergens `useTranslation`** → volledig hardcoded NL; module-labels
  daar i18n-en heeft pas zin met een hele editor-i18n-pass. Module-kleuren (hex in `src/modules/*.js`) +
  categorieën = AW-8.

### ☐ MEDIUM
- [ ] **AW-8 · `CATEGORY_ORDER` = handmatige NL-lijst, gekoppeld aan module-`category`.**
  Key = label; nieuwe categorie = twee plekken bijwerken. → stabiele key + i18n-label.
- [✅] **AW-9 · `date`-veld → native datepicker** (2026-06-23). `workflow/fields.jsx` FieldInput-default
  rendert nu `type='date'` voor date-velden (`effective_from` etc.).

### ☐ LOW
- [✅] **AW-10 · LinksTab-verwijderknop `#FEF2F2` → `var(--color-danger-bg)`** (2026-06-23, one-touch bij AW-2).

---

## Modularity & bestandsgrootte (terugkerende architect-check)

Modulariteit is **een architectuur-dimensie**, geen stijl-detail: een monoliet die data-fetch
+ transform + drawer + businesslogica in één bestand propt, blokkeert hergebruik, verbergt de
entiteit-graaf en verzet zich tegen "10 verdiepingen op het huis". Geadviseerde caps:

**Harde cap (beide): nooit > 1000 r/bestand** (CLAUDE.md §0.3). De cap is het plafond, niet het
doel — de echte regel is **single-purpose, niet line-count**. Bij naderen van een streefwaarde =
**extraheren, niet "nog even erbij"**. Afgesproken standaard (frontend + backend-Claude):

| Laag | Richtlijn (doel) | Splitsen bij |
|---|---|---|
| **FE — component** | ≤ ~250 (250–400 OK als single-purpose) | **> ~400 → subcomponenten** (groeit het door 400 = splitsen, ook als het werkt) |
| **FE — hook / util** | ≤ ~150 (los van componenten) | logica in component → eigen hook |
| **BE — controller** | ≤ ~150 (thin: receive → delegate → Resource; geen logica/queries) | > ~150 → logica naar Service/Action |
| **BE — Service / Action** | ~200–300, één publieke methode | > ~300 of twee verantwoordelijkheden |
| **BE — Model / Resource / Request** | ≤ ~200 | god-model → traits/relaties splitsen |

> Migraties zijn uitgezonderd van de regel-cap, maar volgen wél de `create_<table>`-fold-conventie
> (CLAUDE.md §10 / backend-CLAUDE.md). **Patroon bij overschrijding:** thin container → hooks/api/
> utils + één component per tab/sectie (de kandidaat-feature is de blueprint, §3A).

- [ ] **AW-M1 · Modulariteit als vaste reviewstap.** `/architect` controleert voortaan bestands-
  grootte/decompositie als dimensie 13 (toegevoegd aan `.claude/commands/architect.md`) en CLAUDE.md
  §10 documenteert de workflow-module-blueprint. *(✅ proces vastgelegd 2026-06-23.)*

---

## Refactor-check 2026-06-23 — complete inventaris (frontend `src/`)
Volledige scan op de afgesproken size-discipline. **Backend (`koiosmatch-api`) = aparte repo,
niet in deze workspace** → backend-Claude draait daar dezelfde scan.
**Doelen (bijgewerkt):** JSX ≤ ~250 streven · 250–400 = oordeel (cohesief mag) · **> ~400 = splitsen** ·
1000 = harde cap. JS hook/util/data ≤ ~150.
**Stand (2026-06-23):** de 7 grootste/over-400 zijn gesplitst (WorkflowCanvasEditor·PlanningPage·
AIManagementTabs·WorkflowsPage·AuditLog·UsersPage·Sidebar — zie ✅ hieronder). Resterend > 400: de
419–469-band (ReportFilterSidebar/ShiftsChartsBlock/App/ScheduleSettings/LocationsPage/OrdersTable/
VacanciesPage/MessagesTable/WhatsAppPage/ProfilePage/PlanningPanel) + CandidatesPage 670 & het
WorkflowCanvasEditor-restant 863 (architectuur/hook-keuzes). JS-laag gezond.

### 🟢 Tier 0 — RF-1 CAP OPGELOST 2026-06-23 (1848 → 863 r, onder de 1000-cap)
- [◐] **RF-1 · `components/layout/WorkflowCanvasEditor.jsx` — was 1848 r (~37 units, ~2× cap) → nu 863 r.**
  Opgesplitst in `components/layout/workflow/`: `serialization.js` (66) · `fields.jsx` (397) · `ScheduleModal.jsx`
  (277) · `canvas.jsx` (276) · `contexts.js` (11) · `constants.js` (5). **Harde-cap-overtreding weg.**
  Plak 1 ✅: **graaf-serialisatie** → pure `workflow/serialization.js` (66 r); 2 deep imports → `@/`.
  Plak 2 ✅: **6 field-renderers** (`AgentSelect/FaqSelect/WebhookSelect/Filters/ResponseStructure/FieldInput`)
  → `workflow/fields.jsx` (397 r) + gedeelde `OPERATORS` → `workflow/constants.js`; dynamische `import('../../lib/api')`
  → `@/lib/api`; verweesde icons (`Copy`/`Check`) opgeruimd. Verbatim verplaatst. **1792 → 1404 r**, build+lint groen.
  Plak 3 ✅: **`ScheduleModal` + `scheduleLabel`** (+ interne `DAYS_NL`/`MONTHS_NL`) → `workflow/ScheduleModal.jsx`
  (277 r); verweesde `CalendarDays` opgeruimd. **1404 → 1135 r**. (Lint-`no-undef` ving een runtime-bug: `Play`/`Zap`
  ontbraken in de nieuwe import → toegevoegd. Bevestigt: build groen ≠ correct, lint is de vangrail.)
  Plak 4 ✅: **canvas** (`ModuleNode`/`AddableEdge`/`EdgeFilterPanel`/`OutputPanel` + `NODE_TYPES`/`EDGE_TYPES`) →
  `canvas.jsx`; gedeelde 4 contexts → `contexts.js`; verweesde imports opgeruimd (`createContext`/`useContext`/
  5× xyflow/`Filter`/`OPERATORS`). **1135 → 863 r, onder de cap.** Build+lint groen.
  **Optionele polish (niet meer cap-blokkerend):** `panels/` (ConfigPanel/LogsPanel/ModulePicker) verder uitsplitsen ·
  `MOCK_LOGS`→feed · `DAYS_NL/MONTHS_NL/CATEGORY_ORDER`→i18n (AW-7/8/CS-10) · CS-4 tokenisatie van de nieuwe
  `workflow/`-bestanden (dragen nog hardcoded hex mee).
  **CS-4 follow-up:** `fields.jsx` (397 r) draagt nog de hardcoded hex mee → tokeniseren bij volgende touch +
  evt. splitsen naar `fields/`-submap per renderer.
  Bevat de hele editor: `ScheduleModal` (~240 r), 6 field-renderers (`Agent/Faq/Webhook/Filters/
  ResponseStructure/FieldInput`, ~380 r), canvas (`ModuleNode/AddableEdge/EdgeFilterPanel/OutputPanel`),
  panels (`ConfigPanel/LogsPanel/ModulePicker`), graaf-serialisatie (`stepsToFlow/flowToSteps`) en
  orchestrator `EditorInner` (~450 r). **Split** → `components/layout/workflow/{fields,canvas,panels}/`
  + `ScheduleModal.jsx` + `serialization.js` (pure) + thin `EditorInner`. Meenemen: `MOCK_LOGS` → echte
  feed; `DAYS_NL/MONTHS_NL/CATEGORY_ORDER` → i18n + `lib/formatters` (AW-7/AW-8).

### 🟠 Tier 1 — grote bestanden, gegroepeerd per gebied
> **Regel (bijgewerkt):** **> ~400 r = splitsen** (ook als het werkt). **300–400 = oordeel** — alleen
> splitsen als het >1 ding doet of nog groeit; cohesief single-purpose mag blijven. De lijst hieronder is
> op 300 gesorteerd, maar behandel < ~400 als review-trigger, geen overtreding. (Pages horen sowieso thin, §2.)

**Pages (horen thin §2 — logica → hooks/api, UI → subcomponenten):**
- [✅] `pages/planning/PlanningPage.jsx` — **740 → 162** (thin) (2026-06-23): `AddShiftModal`+cast → `AddShiftModal.jsx` (318); views Month/Week/Day/List+ShiftPill → `views.jsx` (268); date-helpers → `helpers.js` (16). Build+lint groen. *(Draait nog op dummy-data → B-22; AddShiftModal/views nog boven ~250 maar cohesief, evt. later verder splitsen.)*
- [ ] `pages/candidates/CandidatesPage.jsx` — 670  *(stats/predicaten → hooks; InsightsRow extraheren, B-18.6)*
- [✅] `pages/ai/WorkflowsPage.jsx` — **501 → 303** (2026-06-23): transforms → `data/workflowMap.js` (72); `StepPill`+`WorkflowCard`+`MODULE_META`+`STATUS_STYLES` → `WorkflowCard.jsx` (136). Alle 3 < 400. Build+lint groen. *(AW-6 nog open: StepPill uit gedeelde registry voeden i.p.v. lokale MODULE_META.)*
- [✅] `pages/users/UsersPage.jsx` — **464 → 374** (2026-06-23): `NewUserModal`+`ROLES` → `NewUserModal.jsx` (100). < 400. Build+lint groen. *(RoleSelector/EditableAvatar evt. later, cohesief.)*
- [ ] `pages/shiftmanager/LocationsPage.jsx` — 441
- [ ] `pages/vacancies/VacanciesPage.jsx` — 424  *(B-19 loopt)*
- [ ] `pages/whatsapp/WhatsAppPage.jsx` — 422
- [✅] `pages/auth/ProfilePage.jsx` — **421 → 172** (2026-06-24): `profileParts.jsx` (98, gedeelde blocks) + `ProfileDetailsTab` (95) + `ProfileDisplayTab` (107). Build+lint groen.
- [ ] `pages/customers/CustomersPage.jsx` — 375
- [ ] `pages/dashboard/Dashboard.jsx` — 372  *(B-22/B-23)*
- [ ] `pages/shiftmanager/DepartmentsPage.jsx` — 370
- [ ] `pages/shiftmanager/ContactsPage.jsx` — 318

**Settings-secties:**
- [✅] `pages/settings/sections/AuditLog.jsx` — **570 → 288** (2026-06-23): drill-down → `AuditDrawer.jsx` (264); badge/kleur/KPI-keys → `auditShared.jsx` (35, voorkomt circulaire import). Alle < 400. Build+lint groen.
- [ ] `pages/settings/sections/WhatsAppSettings.jsx` — 330
- [ ] `pages/settings/sections/CvTemplateSettings.jsx` — 330

**Layout / shell:**
- [✅] `components/layout/Sidebar.jsx` — **478 → 297** (2026-06-23): `TenantSwitcher` → `TenantSwitcher.jsx` (190). < 400. Build+lint groen.
- [ ] `App.jsx` — 463  *(routing/providers → splitsen)*
- [ ] `components/layout/KoiosPanel.jsx` — 376

**AI / workflows:**
- [✅] `components/ai/AIManagementTabs.jsx` — **712 → 292** (2026-06-23): primitives → `management/shared.jsx` (174); `AgentForm`+`ChatTest` → `management/AgentForm.jsx` (260). Alle 3 < 400. Build+lint groen. *(5 tabs blijven in de hoofdfile, ruim onder de trigger.)*
- [ ] `components/workflows/ScheduleSettings.jsx` — 451

**Reports:**
- [ ] `components/reports/ReportFilterSidebar.jsx` — 469
- [ ] `components/reports/MessagesTable.jsx` — 423
- [ ] `components/reports/RunsTable.jsx` — 378
- [ ] `components/reports/CandidatesReport.jsx` — 336
- [ ] `components/reports/CustomersTable.jsx` — 335
- [ ] `components/reports/CandidatesTable.jsx` — 333
- [ ] `components/reports/CandidateDetailDrawer.jsx` — 305

**ShiftManager:**
- [✅] `components/shiftmanager/ShiftsChartsBlock.jsx` — **468 → 141** (2026-06-24): `shiftsChartsConfig` (28) · `shiftsChartsWidgets` (92) · `useShiftsChartData` (146, fetch+transform+bars) · `buildShiftsFilterGroups` (121). Build+lint groen.
- [ ] `components/shiftmanager/OrdersTable.jsx` — 428

**Candidates drawer · Context:**
- [✅] `pages/candidates/drawer/PlanningPanel.jsx` — **419 → 79** (2026-06-24): thin router + `PlanningScheduling` (144) · `PlanningOpenShifts` (131) · `PlanningFavorites` (137). State blijft gelift in de container. Build+lint groen.
- [ ] `context/AuthContext.jsx` — 312

### 🟡 Tier 2 — 250–300 r (onder de 400-trigger; cohesief = prima, meenemen bij volgende aanraking)
- [ ] `CandidateLookupsSettings` 293 · `pages/candidates/CandidateCvTemplate` 288 ·
  `ShiftsDrillDownDrawer` 281 · `KpiDrillDownDrawer` 278 · `RolesSettings` 276 ·
  `pages/tasks/TasksPage` 274 · `pages/auth/LoginPage` 269 · `drawer/AvailabilityCalendar` 266 ·
  `pages/candidates/CandidateDrawer` 263 · `pages/applications/ApplicationsPage` 262 *(B-18)* ·
  `EmailSettings` 261 · `components/reports/ContactPersonsTable` 259 · `AddCandidateModal` 253.

### 🟢 JS (hook/util/data) > 150 r — laag, lage prioriteit
- [ ] `pages/applications/data/mocks.js` — 188  *(test-mock; verdwijnt als de echte API live is)*
- [ ] `pages/candidates/data/mapCandidate.js` — 163  *(eventueel per sub-entiteit splitsen — bron-van-waarheid C-23)*
- [ ] `lib/access.js` — 161

> **Veilig refactoren:** elk item is puur structureel (extractie zonder gedragswijziging). Volgorde:
> eerst een test/regressie-net waar het ontbreekt, dan extraheren, dan visueel verifiëren (geen
> functionele change in dezelfde commit). RF-1 eerst — die bundelt met AW-1/AW-6/AW-7/AW-8.

## Consistency & standards-audit 2026-06-23 (buiten de regel-cap)
Codebase-brede meting tegen CLAUDE.md. **Kernconclusie:** de code is consistent *met zichzelf*,
maar wijkt structureel af van de **gedocumenteerde standaard**. De kandidaat-feature (de blueprint)
zit het dichtst bij spec; oudere gebieden niet. Cijfers zijn metingen, geen schatting.

### 🔴 CRITICAL
- [ ] **CS-1 · Auth-token in `localStorage` (§7).** In de default Bearer-modus staat `auth_token`
  in `localStorage` → XSS-exfiltreerbaar. Er is een **uitgewerkt hardening-pad** (`lib/authMode.js`
  `COOKIE_AUTH`, nu OFF): httpOnly-cookie + CSRF (Sanctum SPA). → gecoördineerde flip met backend
  (CSRF-cookie-endpoint + stateful auth), dan `VITE_COOKIE_AUTH=true`. Top-prioriteit security.
- [◐] **CS-2 · Error Boundary (§3) — globaal GEBOUWD 2026-06-23.** Herbruikbare
  `components/ui/ErrorBoundary.jsx` (token-gestyled fallback, i18n ×5, PII-safe: rauwe error alleen
  in DEV) + **globale boundary** rond `<Routes>` in `App.jsx`. **Rest:** lokale boundaries rond zware
  widgets (charts, drawers, workflow-canvas) — `<ErrorBoundary compact>` eromheen bij de RF-refactors.

### 🟠 HIGH
- [ ] **CS-3 · Styling: inline-styles i.p.v. Tailwind (§1/§4).** **223 van 263** jsx-bestanden
  gebruiken inline `style={{…}}` (**4129 blokken**); slechts **79** gebruiken `className`. De stack
  schrijft **Tailwind utility-first** voor. → **OPEN BESLISSING (Danny):** óf de stack-regel bijstellen
  naar "inline-CSS-in-JS via tokens" (eerlijk = wat er staat), óf Tailwind echt invoeren.
  **Advies = tokens via inline** (zie Advies-sectie). Niet in één keer omzetten; koppel aan de RF-refactors.
- [◐] **CS-4 · Hardcoded hex → tokens (§4) — GESTART 2026-06-23.** Begonnen bij de **gedeelde
  `components/ui`-laag** (hoogste leverage): KpiCard/MonthlyKpiCard/StatCard/KpiBlock/StatusBadge/
  EntityListDrawer → neutrale grijzen → `--text`/`--text-muted`/`--border`/`--hover-bg`, semantisch →
  `--color-success/danger/warning-bg`, `bg-white`/`'white'` → `var(--surface)`. **72 → 12 hex** (rest =
  bewust data/merk: `*Mark`-merk-kleuren, `Avatar`-palet, `StatusPill` hex-math-fallback, 2 violette
  delta-labels zonder token). Build + lint groen. **Mapping-regel vastgelegd** (hieronder).
  **Gedeelde `components/`-laag nu compleet:** ook `components/forms` (AddableSection/fields),
  `components/drawer` (EntityHeader) en `components/charts` (5×: card-borders/tooltip/axis-chrome →
  tokens; **Recharts `var()`-in-`fill/stroke` bevestigd werkend**; de `COLORS`-serie-paletten blijven hex = data).
  **Rest:** settings-secties (546 hex), reports (498), pages — **niet blind**: data-kleuren (pool/recruiter/
  chart/lookup-seeds, `lib/colorPresets.js`, `index.css`) blijven hex. Liften mee op RF-*.
  > **hex→token mapping (canoniek):** `#9CA3AF`/`#6B7280`→`--text-muted` · `#111827`/`#374151`→`--text` ·
  > `#E5E7EB`/`#D1D5DB`/`#F3F4F6`→`--border` · `#F9FAFB`/`#FAFAFA`→`--hover-bg` · `white`→`--surface` ·
  > `#F0FDF4`→`--color-success-bg` · `#FEF2F2`→`--color-danger-bg` · `#FFF7ED`→`--color-warning-bg`.
  > **Nooit converteren:** hex die met `+ '20'`/alpha wordt geconcat (soft-chip), kleur-arrays/paletten,
  > merk-kleuren, lookup/chart-seedkleuren, `index.css` zelf.
- [ ] **CS-5 · PropTypes ontbreken (§1).** **3 van 263** componenten hebben `propTypes`; 5 ts/tsx-bestanden.
  §1: "PropTypes zijn het minimum op elke component." → PropTypes toevoegen bij elke aanraking, of
  (sterker, §1-advies) gedeelde lagen naar **TypeScript** migreren.
- [ ] **CS-6 · API-calls inline in componenten (§10).** **70** jsx-bestanden roepen `api.*` direct aan;
  **0** feature-`api/`-mappen. §10: "API-calls in de feature-`api/`-map, nooit inline." → data-laag per
  feature extraheren (mirrort RF-4/B-18.6: logica naar hooks/api).
- [◐] **CS-7 · NL-identifiers in code (§0.1) — code-identifiers GEDAAN 2026-06-23.** Candidate-drawer
  hernoemd (whole-word, file-local): `isGepland→isScheduled`, `toggleIngepland→toggleScheduled`,
  `isBl/FavKlant→isBlocked/FavCustomer`, `isBl/FavLocatie→…Location`, `dienstenForDate→shiftsForDate`,
  `rijOpen→rowOpen`. Build+lint groen. **Bewust gelaten:** mock-data-keys (`mocks.js` kandidaat/sollicitatie),
  permissie-keys (`kandidaatbeheer`) en NL-comments — data/contract, geen code-identifiers.

### 🟡 MEDIUM
- [◐] **CS-8 · Path-alias (§11) — GEBOUWD 2026-06-23.** `@/` → `src/` in `vite.config.js` +
  `tsconfig.json` (`paths`, editor-resolutie) + ESLint `no-restricted-imports` **warn** op `../../**`
  (geverifieerd: deep import → warning, `@/` → schoon, build slaagt). **Rest:** de 425 bestaande
  deep-imports per-touch omzetten (one-touch-regel) — nu nog warnings.
- [ ] **CS-9 · Test-dekking dun (§13).** **11** testbestanden op **367** bronbestanden (~3%). §13 wil
  kritieke paden gedekt (forms, auth-gated UI, tabellen, vier UI-states). → bij elke RF-/bugfix een
  regressietest; dit is ook het **vangnet** dat de refactors veilig maakt.
- [ ] **CS-10 · Hardcoded user-facing strings buiten i18n (§5).** Naast de module-registry (AW-7):
  `DAYS_NL`/`MONTHS_NL` (editor), mock-/dummy-labels in Dashboard e.a. → i18n + `lib/formatters`
  (datums via `Intl`/`nl-NL`). Overlapt met RF-1 en B-22/B-23.

### ✅ Wél consistent / compliant (ter geruststelling)
- `console.*` in committed code: **0** (§11 ✅).
- `dangerouslySetInnerHTML`: alleen via `components/ui/SafeHtml.jsx` met **DOMPurify** + reden-comment (§7 ✅).
- Eén geconfigureerde axios-client met interceptors (401/403, CSRF-scaffold) in `lib/` (§10 ✅).
- Soft-chip-conventie + potlood/diskette-edit + EntityDrawer-shell: consistent in de candidate-blueprint (§3A ✅).

> **Rode draad:** de meeste CS-items zijn **mechanisch en per-bestand**, dus ze liften mee op de
> RF-refactors — één bestand aanraken = cap + hex→token + inline→? + PropTypes + NL→EN + alias in één pass.
> **Beslis eerst CS-3** (Tailwind vs inline-tokens): dat bepaalt hoe CS-3/CS-4 samen worden aangepakt.

## Data-audit 2026-06-23 (komt alles uit de API? duplicates?)
Scan op hardcoded/dummy-data, mock-fallbacks en duplicatie (§3B "niets hardcoded", DRY).
Markers: ☐ open · ⚠️ jouw input · ◐ deels · ✅ klaar. Werk punt voor punt af.

### ⚠️ EERST: welke API's zijn LIVE? (bepaalt of de mock eruit kan)
Per pagina de endpoints die de fallback-mock voedt. **Live → mock eruit + lege staat; mist → mock blijft.**
- [ ] **PlanningPage** — **0 api-calls**, 100% `INITIAL_SHIFTS`. Endpoint? (`/planning` of `/shifts`) → live? ⚠️
- [ ] **ContactsPage (SM)** — 0 api-calls, pure dummy. ⚠️
- [ ] **CandidatesPage** — `/candidates · /candidates/stats · /candidates/bulk/* · /locations` → live? ⚠️
- [ ] **ApplicationsPage** — `/applications · /applications/stats` → live? ⚠️
- [ ] **VacanciesPage** — `/vacancies · /vacancies/stats · /vacancies/bulk/* · /customers` → live? ⚠️
- [ ] **WorkflowsPage** — `/workflows · /workflow-folders` → live? ⚠️
- [ ] **SM Customers/Locations/Departments** — `/sm_customers` → live? ⚠️

### 🔴 DS — Data-sourcing (hardcoded/dummy i.p.v. API)
- [ ] **DS-1 · PlanningPage draait 100% op dummy** (`INITIAL_SHIFTS`, 0 api-calls). → echte planning-API + vier UI-states.
- [ ] **DS-2 · ContactsPage (SM) pure dummy** (0 api-calls). → `/sm_*`-bron of lege staat.
- [ ] **DS-3 · Mock-fallbacks eruit** (CandidatesPage `DUMMY_CANDIDATES` · WorkflowsPage `MOCK_WORKFLOWS` ·
  applications/vacancies/SM `USE_MOCKS`): API wordt al geroepen, maar dummy bij fout → **lege staat** i.p.v. dummy.
  Verwijderen zodra het endpoint live is (zie ⚠️-lijst). **Mag nooit in productie tonen.**
- [ ] **DS-4 · `MOCK_LOGS`** in `WorkflowCanvasEditor` → echte run-logs-feed (workflow-server, memory `project-workflow-separate-server`).

### 🔁 DUP — Duplicatie (geen dubbele data/select/iets)
- [◐] **DUP-1 · 2 van de "9" waren echte duplicate-selects → opgeruimd** (`BranchSection`→`SearchSelect`,
  `AddApplicationModal`→`CreatableSelect`); de overige 7 zijn kleur-pickers/uitklap-toggles/custom meta-pickers
  (geen select). Oorspronkelijke (te brede) bevinding hieronder:
- [ ] ~~**DUP-1 · 9 inline custom dropdowns** herbouwen open/close/outside-click zelf i.p.v. een gedeelde select:~~
  `BranchSection · UsersPage · AddApplicationModal · EntityHeader · KoiosModelPicker · MatchScoreBlock ·
  SettingsControls · KoiosSteps · ai/management/shared`. → vervangen door `SelectMenu`/`SearchSelect`/`CreatableSelect`.
- [ ] **DUP-2 · 4 select-componenten** (`SearchSelect` multi · `SelectMenu` single · `CreatableSelect` combobox ·
  `SelectField` basic) — deels legitiem; documenteer wanneer welke + zorg dat niemand een 5e bouwt.
- [ ] **DUP-3 · `LANGUAGES` in 2 bestanden** (`CompanySettings` + kandidaat-talen) → één lookup (`/languages`).
- [ ] **DUP-4 · SM `STATUSES`/`AddCustomerModal STATUSES` hardcoded** terwijl kandidaat-statussen een lookup zijn → consolideren.

### 🟠 VOC — Hardcoded vocab → lookups (§3B)
- [ ] **VOC-1 · `NATIONALITIES`** (`ProfileTab`, 11 hardcoded) → lookup/gedeelde lijst.
- [ ] **VOC-2 · `CompanySettings`** (`LANGUAGES/CURRENCIES/TIMEZONES/COUNTRIES`) → lookups/standaardlijsten.
- [ ] **VOC-3 · SM `AddCustomerModal STATUSES`** → lookup.

### ✅ Wél OK (structuur/contract-keys, geen tenant-data)
`lib/access.js` page-keys · `AI_PACKAGES`/`ATS_BASE` · `TAB_IDS` · `BUCKETS`/`DIMENSIONS`/`APP_FIELDS`/
`BUILTIN_TOOLS`/`ROLES`/`QUARTERS`/`LEVELS` — mogen hardcoded (geen lookup nodig).

## Advies & aanbevolen volgorde (2026-06-23)
De lijst is compleet: **AW** = data-coherentie, **RF** = bestandsgrootte, **CS** = standaard-consistentie.
Aanbevolen aanpak — veilig, hoogste ROI eerst, geen big-bang.

**Open beslissing (Danny) — styling-standaard (CS-3): advies = "tokens via inline".**
4129 inline-blokken naar Tailwind herschrijven = enorm + risicovol zonder functionele winst, juist nu
de testdekking dun is (CS-9). Wat vandaag pijn doet is **theming**, en dat is **CS-4 (hex)**, niet de
inline-vs-Tailwind keuze — inline styles met tokens themen prima. Dus: erken inline-CSS-in-JS + tokens
als standaard, update CLAUDE.md §1/§4 zodat de regel klopt, en steek de energie in CS-4. (Tailwind mag
blijven voor nieuwe gedeelde componenten.)

**Volgorde:**
1. **Vangnet eerst** — CS-2 (Error Boundary: klein, los, beschermt meteen én tijdens de refactors) +
   een minimaal regressie-net op de te splitsen bestanden (CS-9).
2. **CS-8 (alias)** — eenmalige Vite-config + lint-regel; goedkoop, en de refactors gebruiken meteen `@/`.
3. **CS-4 (hex → token)** — losse mechanische sweep; lost dark/tenant-theming op. **Hoogste ROI.**
4. **CS-1 (auth-cookie)** — security; backend-coördinatie nu starten, flip later. Tracken, niet blokkeren.
5. **RF-1** — de enige cap-overtreding; bundelt AW-1/6/7/8 + CS-7/CS-10 (DAYS_NL/CATEGORY_ORDER).
6. **RF tier-1 pages → tier-2** met de **one-touch-regel**: raak je een bestand aan, ruim dan meteen z'n
   CS-items op (hex→token, NL→EN, PropTypes, alias, inline-api→hook). Zo lost de schuld zichzelf op
   zonder aparte mega-PR.

## Proces / bron van waarheid
- [✅] **P-1 · `docs/ARCHITECTURE.md` AANGEMAAKT 2026-06-23.** Bron-van-waarheid met status-markers
  (✅/⚠️/☐/🔒) per punt: entiteiten + relaties, de 3 assen + status↔funnel-automatisering, match-model,
  blueprint, lookups, workflow-modules (graaf), filter-vocabulaire, task_links, tenant/pakket, theming-
  tokens, auth, endpoint-naamgeving, API-contract-pointers, maat/modulariteit, en §11 "openstaand —
  punt voor punt afronden" (verwijst hierheen). **Punt-voor-punt afronden** = de openstaande markers vullen.

## Backend-coördinatie (samenvatting)
1. **C-27** — graaf opslaan/teruggeven (`position` + `connections`), stabiele step-`id`'s,
   `type × action`-handlers, gedeeld filter-`field`-vocabulaire (`function_title`/`owner_id`/`funnel_type`).
2. **C-18** — bevestig de **aparte** `POST|DELETE /tasks/{id}/links` (return = task-detail met
   `links:[{type,id,label}]`).
3. **Picker-endpoints** — `search`+`limit` op `/candidates|/customers|/contacts|/vacancies`.
4. **Workflow-engine op aparte server** (beslissing Danny 2026-06-23 · memory `project_workflow_separate_server`):
   uitvoering/runs/logs/queues hoort apart van de hoofd-API. **FE-consequentie:** workflow-execution-/runs-/
   logs-/queue-endpoints via een **configureerbare base-URL** (bv. `VITE_WORKFLOW_API_URL`) + run/logs-UI
   **async/queue-aware** (poll/queue-staat, geen synchroon resultaat). `MOCK_LOGS` → echte feed.
