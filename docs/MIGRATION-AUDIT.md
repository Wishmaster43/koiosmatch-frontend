# Koios Match — TS-migratie + Audit-logboek

> **Lopend logboek van de full-repo TS-migratie-pass** (zie [`MASTER-PLAN.md`](./MASTER-PLAN.md) §P4 /
> [`MASTER-WORKLIST.md`](./MASTER-WORKLIST.md)). Elk bestand dat ik migreer krijgt **in één pass**:
> TypeScript · architect/contract-check · audit (security/i18n/a11y/4-states/file-size) · duplicate-opschoning ·
> één Engelse comment per blok. Bevindingen die ik **niet** ter plekke fix (backend nodig, of groter werk)
> log ik hier met **severity** zodat niks verloren gaat.
>
> **Severity:** 🔴 BLOCKER · 🟠 HIGH · 🟡 MEDIUM · 🔵 LOW. **Owner:** [FE] / [BE] / [D]anny.
> **Per-golf groen-criterium:** `npm run typecheck` + `lint` + `test` + `build` — alle vier groen → commit.

---

## Voortgang per golf

| Golf | Scope | Status | Commit |
|---|---|---|---|
| 0 | Fundament: `tsconfig` (baseUrl weg) · `typecheck`-script · dit logboek · types-strategie | ✅ klaar | 62b2806 |
| 1a | Dedup `initialsOf` (17 kopieën → `src/lib/initials.ts`) | ✅ klaar | a8e7f1b |
| 1b | **Alle 6 data-mappers → `.ts` + entiteit-types** (candidate · application · vacancy · customer · opportunity · task) | ✅ klaar | 58af15a/f4a1c9c/… |
| 3c | **Candidate-feature volledig TS** — page · table · bulkbar · modal · cv-template · drawer + **alle 30+ drawer-tabs/secties** (profile · communication · languages · pools · documents · sections · work · preferences/zzp · changelog · statistics · background · matches · **planning** sub-tabs + `planningTypes.ts`) | ✅ klaar | 18daab9 |
| L | **`lib/` 100% TS** — datetime · queryClient · chartHelpers · queries · usePageSize · colorPresets · mocks · **lookup-hooks** (functions/genders/languages/industries/last-contact/customer/opportunity) + dedup → `lookupUtils.ts` · access · useCv/KpiSettings · `settings/` (moduleRegistry/useAllSettings/useModuleView) | ✅ klaar | 004d272 |
| C | **`context/` 100% TS** — Auth · RightPanel · Theme · Lookups · TaskLookups · VacancyLookups · Apps (typed providers + value-interfaces; NL-comments → EN) | ✅ klaar | 3cbc008 |
| 2 | **Gedeelde blueprint-bouwstenen — compleet** — `drawer/` (DrawerTabs · EntityDrawer · EntityHeader · tabs/NotesTab · tabs/StatsTab) · `forms/` (AddableSection · AddForm · fields · EditableFieldTable) · `insights/InsightsRow` | ✅ klaar | a61c859 |
| 2b | **`components/charts/` compleet** — Mini/Line/Bar/Pie/WeeklyBar + gedeelde `chartTypes.ts` (ChartDatum + recharts TipProps) · `components/settings/` (ModuleView · ViewConfigEditor) | ✅ klaar | d406b8f |
| 3a | **Customers-feature 100% TS** — page (container) · table (`Column<Customer>`) · bulkbar (`MenuNode`) · drawer + 10 drawer-tabs · 4 add-modals · `SubEntityTab<Item>` · PlanningSummary | ✅ klaar | 562180f |
| 3b | **Applications-feature 100% TS** — page · table · board (kanban, dnd) · drawer + 9 tabs (Application/Candidate/Vacancy/Interviews/Appointments/Notes/Timeline/MatchScore/Rejection) · add-modal | ✅ klaar | 40fab37 |
| 3c | **Vacancies-feature 100% TS** — page · table · bulkbar · drawer + 8 tabs (Details/Applicants/Matching/Publishing/Documents/Timeline/Notes/Statistics) · add-modal · **2 hooks** (useVacanciesData · useVacancyBulkActions) · shared | ✅ klaar | 1382cb3 |
| 3d | **Tasks-feature 100% TS** — page · table · board (kanban) · drawer + 4 tabs (Details/Links/Comments/Activity) · add-modal · polymorphe links | ✅ klaar | 8793304 |
| 3e | **Opportunities-feature 100% TS** — page · table · board (kanban) · insights-row · drawer + DetailsTab · add-modal | ✅ klaar | 34ebd2f |
| M | **`src/modules/` workflow-registry 100% TS** — 55 files: gedeelde `types.ts` (ModuleDef + SchemaField) · `makeEntityModule` factory · 53 module-defs · `index.ts` (MODULES + afgeleide maps). Icon spiegelt het lucide-contract (`size`) zodat SM/HF-marks erin passen | ✅ klaar | 55eeb0f |
| A | **`pages/auth/` 100% TS** — LoginPage (mfa-step-up) · ProfilePage (thin container) · ProfileDetailsTab · ProfileDisplayTab · ProfileEmailConnect · ProfileWhatsAppWeb · profileParts (gedeelde `ProfileFormData`) · `whatsappWeb/` (statusMeta + `useWhatsAppWeb` + device-card). `User`-type kreeg `phone`/`avatar_url`/`default_per_page` (single source) | ✅ klaar | e06eab0 |
| LF | **Leaf-pages TS** — `matches` (page+table, **donut-filter herbedraad** naar de huidige InsightsRow-API + `KpiSpec.value` verbreed naar `number\|string`) · `whatsapp` (page + components, `types/whatsapp.ts`) · `dashboard` (1 bestand, `types/dashboard.ts` voor de losse /dashboard-payloads; chart-data via `as ChartDatum[]`) | ✅ klaar | bcd…/_pending_ |
| R | **`components/reports/` 100% TS** — 18 bestanden: 7 tabellen (Candidates/Customers/Departments/Locations/ContactPersons/Runs/Messages) · 6 drawers (Candidate/Customer/Contact/Location/Department/Drill/KpiDrill) · CandidatesReport (charts+drilldown) · CandidatesKpiRow · ReportFilterSidebar · runFormat. Gedeelde types in [`src/types/reports.ts`](../src/types/reports.ts) (ShiftManager-mirror rows met index-sig voor dynamische sort + `ReportFilterGroup`/`FilterOption`). Dynamische-key-sort via `(av as number)`-cast; chart-handlers `(data: unknown)` + ChartDatum-cast | ✅ klaar | _pending_ |
| 3+ | **Alle 6 entity-features + modules + auth klaar.** Resterend (niet-candidate/settings): components/reports (18) · shiftmanager (38) · components/layout (17, **Sidebar.jsx = WIP andere Claude, skip**) · ai (8) · planning/matches/whatsapp/dashboard (9) | ☐ | — |

> **Werkverdeling (Danny, 2026-06-26):** de candidate-feature (incl. nieuwe instelbare lookups **Rijbewijs** en
> **Voorkeurs branche** — zelfde patroon als Kandidaat-type: `LookupsContext` + `useX()` + Settings-CRUD, §3B)
> is voor de **andere Claude**. Ik (deze Claude) blijf op de TS-migratie in **niet-candidate** mappen en raak
> hun WIP niet aan.

> **Let op (2 Claudes parallel):** de candidate-feature wordt momenteel live verder bewerkt door de andere Claude
> (nieuwe `CandidateTypeSection`/`ChangelogPopover`, `onToggleZzp`/`onTypesChange` op de Preferences-tab). Tijdens
> golf 3c stond hun **uncommitted** CandidateDrawer-WIP rood in de werkboom — mijn vacancies-commit is daarvan
> losgekoppeld (alleen vacancies-paden gestaged) en HEAD blijft groen. Hun prop-mismatch lossen zij op hun kant op.
| M | `src/modules/` workflow-registry (55) — per-entity `makeEntityModule`-config | ☐ | — |

> **Herbruikbare entity-patronen (vastgelegd via candidates+customers):** `Column<Entity>[]` voor de tabel ·
> `MenuNode[]` voor de bulkbar · `SubEntityTab<Item extends object>` (constraint `object`, niet
> `Record<…>` — interfaces missen index-sig) · optimistische spreads `({ ...c, ...patch } as Entity)` ·
> entity-`Note`-types krijgen `[k: string]: unknown` voor NotesTab-compat · `EntityHeader` `MetaPicker.onChange`
> = `(v: string)`. De volgende features (applications/vacancies/tasks/opportunities) volgen dit 1-op-1.

> **Mijlpaal (golf 2/2b):** de **hele herbruikbare kern is TS** — `lib/` · `context/` · alle gedeelde
> blueprint-componenten (drawer-shell · forms · insights · charts · settings-views) + de **candidate-feature
> volledig**. Resterend werk is per-feature/leaf (importeert getypte bouwstenen, geen ripple terug). 108→~135
> TS-bestanden; ~310 `.jsx/.js` over.

**Types-strategie:** infra-types in [`src/types/api.ts`](../src/types/api.ts) (User/Tenant/ListResult/…).
Entiteit-types (Candidate, Application, Vacancy, …) komen **per feature-golf** in `src/types/<entity>.ts`,
getypt tegen de échte API-response, importeerbaar door andere features. Nieuw bestand = altijd `.ts`/`.tsx`.

---

## Bevindingen (per severity, gevonden tijdens de pass)

> Format: `[severity] [owner] <titel> — <file:regel> — <probleem> → <vereiste fix>`

### 🔴 BLOCKER
- _(geen)_

### 🟠 HIGH
- [HIGH] [FE] **Settings-registry volledig hardcoded** — `src/pages/settings/registry.jsx` — 66 nav-labels,
  0×`t()` → hele Settings-nav is Engels island → alle labels via `t()` × 5 locales (worklist **FE-P3-3**).

### 🟡 MEDIUM
- [MEDIUM] [FE] **ViewConfigEditor hardcoded EN-strings** — `src/components/settings/ViewConfigEditor.tsx`
  ("Saved/Saving/Save/Move up/Move down/Hide/Show" + de "Choose which blocks…"-zin, 0×`t()`) → via `t()`
  × 5 locales. Engels island (geen NL), lager prio dan NL-islands; behouden gedrag, gelogd. Idem `ModuleView`-loze.
- [MEDIUM] [FE] **AppsContext app-descriptions hardcoded NL** — `src/context/AppsContext.tsx` `AVAILABLE_APPS[].description`
  (5× Dutch literal, getoond in Settings → Apps) → via `t('apps.*')` × 5 locales. Niet ter plekke gefixt (zou
  locale-keys vergen buiten de TS-scope); behouden gedrag, gelogd als i18n-schuld.
- ✅ **[OPGELOST in Golf 2] EditableFieldTable hardcoded NL-tooltips** — "Bewerken/Opslaan/Annuleren/Selecteer"
  (0×`t()`) → nu `t('edit'/'save'/'cancel'/'select')` (common-namespace, keys bestonden al). §5 nageleefd bij touch.
- ✅ **[OPGELOST in Golf L] lookup-parsing 5× gedupliceerd** — `names()`/`normalize()` copy-paste in 7 lookup-hooks
  + 2 contexts → één bron [`src/lib/lookupUtils.ts`](../src/lib/lookupUtils.ts) (`lookupNames` + `normalizeOptions`,
  id-behoudend). Candidate/Task/Vacancy-contexts houden hun eigen normalize (dragen is_applicant/is_done mee).
- ✅ **[OPGELOST in Golf 1a] `initialsOf` gedupliceerd** — bleek **17 kopieën** met 4 fallback-varianten
  ('?'/'T'/'–'/'') → één bron [`src/lib/initials.ts`](../src/lib/initials.ts) met `fallback`-param;
  3 shared-modules re-exporteren, call-sites houden hun fallback. 0 lokale defs over.

### 🔵 LOW
- _(geen)_

---

## Gefixt tijdens de pass
- **Golf 1b — drift gevangen door de types:** `created_at` ontbrak in `ApiTask` (viel op de
  index-signature → `unknown ?? '' = {} | string`) → gedeclareerd. **Quirk gefixt:** mapCustomer
  mapte de fallback-departments dubbel (`locations.flatMap(...).map(mapDepartment)` op al-gemapte
  data) → nu conditioneel, geen redundante her-mapping. Overige 5 mappers: geen drift (contract klopt).
- **Golf 0 — `setState-in-useMemo` (4× baseline, React-19 error):** `setPage(1)` ín de filter-`useMemo`
  van MatchesPage:72 · OpportunitiesPage:65 · TasksPage:133 (zelfde copy-paste-drift als de eerder
  gefixte ApplicationsPage) → verplaatst naar een `useEffect` op de filter-deps. + ongebruikte `user` in
  CustomersPage:29 verwijderd. **Baseline lint/typecheck nu groen** → migratie kan "groen per golf" draaien.

---

## Backend-coördinatie (uit de pass)
- _(nog geen — verwijst naar `worklist.md` C-items + MASTER-WORKLIST BE-tabel)_
