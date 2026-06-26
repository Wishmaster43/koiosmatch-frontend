# Koios Match — MASTER PLAN (wat moet er gebeuren)

> **Eén bron voor "wat moet er gebeuren", geprioriteerd.** Samengesteld 2026-06-25 uit:
> `CLAUDE.md` · `ARCHITECTURE.md` · `docs/worklist.md` (backend C-items) · `docs/architect-Worklist.md`
> (AW/CS/RF/DS/DUP/VOC) · `.claude/commands/architect.md` · `.claude/commands/audit.md` ·
> `.claude/commands/REFACTOR & AUDIT SPECIALIST` · **alle 27 Claude-chats (679 Danny-berichten)**.
>
> **Leesregel bij tegenspraak (uit de SPECIALIST-rol):** spreekt een doc de code/git tegen → **flag het
> en vraag Danny welke de bron is** vóór je handelt. Eén drift staat al hieronder gemarkeerd (§2, auth).
>
> **Markers:** ✅ klaar · ◐ deels · ☐ open · ⚠️ beslissing Danny · 🔒 backend-gated · 🔴 BLOCKER.
> **Werkregels (altijd):** English code + **één Engelse comment per logisch blok** · file-cap 1000 (split
> > ~400) · alles via `lib/api` (tenant-aware) · UUID `id` nooit `external_id` · i18n all-or-nothing × 5
> locales · niets hardcoded (lookups via API) · per deliverable de Self-Audit (§9) · alles op **main**.

---

## 1. Het product in één scherm

**Koios Match** = multi-tenant SaaS voor Nederlandse zorg-flexbemiddeling. Data = **special-category
(gezondheid)**, AVG/GDPR. Primaire tenant **Yesway Flex B.V.**; daarnaast demo + toekomstige tenants.
Eén gebruiker kan tussen tenants **switchen** (super-admin / multi-bureau), maar logt **één keer** in.

**Modules (pakket-gestuurd):** ATS & CRM (kern) · AI Agents & Workflow · Planning (add-on) ·
Rapportage ShiftManager · Rapportage HelloFlex. **Pakketten:** Core (ATS+CRM) · Pro (+ AI & Workflow) ·
Enterprise · **losse add-ons** (planning, SM/HF-rapportage, AI-planner) + **App-connectors** (alleen met
AI & Workflow). **Super Admin** = alleen Danny: modules per tenant inrichten + **verbruik per tenant**
(AI-tokens, WhatsApp-nummers) voor facturatie — **nooit alle klanten tegelijk tonen**.

**Entiteiten (alles gelinkt):** Candidate · Opportunity · Vacancy · Application · **Match**(+match-score)
· Task · Workflow · TalentPool · Customer → Location → Department → Contact · (native, later) Order →
Shift → ScheduledShift. **ShiftManager/HelloFlex = externe spiegels** (read-only, `sm_`/`hf_`-prefix).

**Portals/apps (aparte repos, later):** `koiosmatch-client-portal` (klant: eigen diensten/locaties/
kostenplaatsen/contacten + kandidaten favoriet/blacklist) · `koiosmatch-candidate-app` (kandidaat neemt
diensten aan). Tenant van het klantportaal = via **subdomein**.

**6-server-topologie (respecteren):** Backend API · Frontend (static dist) · **Workflow-server (zwaar —
FE triggert/poll't, blokkeert nooit)** · **WhatsApp private server (Baileys — FE praat ALLEEN via
backend, nooit direct)** · Load balancer (geen sticky-state) · Danny's dashboard (deelt componenten).

---

## 2. Niet-onderhandelbare fundamenten (+ 1 drift)

1. **English-only** code/comments/commits/docs; **één Engelse comment per blok** (function/hook/effect/
   handler/mapping) — verplicht en afdwingbaar (de "kostenhefboom": externe dev snapt elk blok in seconden).
2. **Modulariteit & file-size:** single-purpose; component ≤ ~250 · hook/util ≤ ~150 · > ~400 = split ·
   1000 = harde cap. Logica in hooks, niet in JSX. Feature-folders (`pages/<entity>/` met `data/`, `hooks/`,
   `drawer/`). Een feature raakt nooit de internals van een ander — alleen via de publieke surface.
3. **i18n all-or-nothing × 5 locales (nl/en/de/fr/es).** Geen hardcoded user-facing string, geen Dutch
   islands, geen label naast een `t()`-key, geen missende key (val nooit stil terug op Dutch). `Intl`
   (nl-NL) voor datums (DD-MM-YYYY)/getallen.
4. **Niets hardcoded = alles uit de API.** Status/funnel/candidate-types/genders/functies/talen/niveaus/
   pools/note-types/last-contact-types/rejection-reasons/industries/nationalities/vacancy-* = **tenant-
   lookups via Settings**; FE alleen seed-fallback via `useX()`/`LookupsContext`. Kleuren/labels uit de API.
5. **Security (de client is vijandig):** geen secrets in client · geen `dangerouslySetInnerHTML` zonder
   DOMPurify + reden · geen PII/IDs/tokens in URLs/logs/analytics · externe links `rel="noopener
   noreferrer"` · autorisatie nooit client-side beslist (backend her-checkt) · CSP-houding · `npm audit`.
   ✅ **D1 BESLOTEN (2026-06-26): Sanctum httpOnly-cookieflow** (= `CLAUDE.md §7`). Het huidige
   **Bearer-token-in-localStorage** (XSS-exfiltreerbaar) wordt uitgefaseerd; **API-keys blijven token**
   (externe consumers). Code gaat naar de doc toe — §7 ongewijzigd. Uitvoering = gezamenlijk:
   backend Sanctum stateful-domains + CORS-credentials + CSRF-cookie (**BE-8**), dan FE-flip (**N-2**).
   FE-scaffold bestaat (`VITE_COOKIE_AUTH`). **Niet flippen vóór backend klaar** (breekt login).
6. **AVG/gezondheidsdata:** data-minimalisatie (haal alleen wat het scherm nodig heeft) · nooit PII loggen
   · velden maskeren per rol · respecteer gewiste/geanonimiseerde staat (nooit renderen) · soft-delete met
   actieve-koppeling-check vóór verwijderen.
7. **Vier UI-states altijd** (loading/error/empty/success) · global ErrorBoundary in `app/` + lokale rond
   zware widgets · **lege/foutieve call → lege staat, nooit verzonnen rijen.**
8. **Tenant-scoping & naming:** alles via `lib/api` · UUID `id` intern · native = schoon (`/candidates`,
   `/customers`, …) · ShiftManager = `sm_` · HelloFlex = `hf_`.

---

## 3. Huidige stand (✅ wat staat er al — niet opnieuw bouwen)

- **Entiteit-blueprint = candidate-feature** (Page · Table → shared `DataTable` · InsightsRow config-driven
  · BulkBar → `ActionMenu` + `bulkMutate` · AddModal · Drawer + tab-componenten). Spiegel dit per entiteit.
- **Refactors (deze sessie):** ProfilePage 421→172 · PlanningPanel 419→79 · ShiftsChartsBlock 468→141 ·
  OrdersTable 428→182 · LocationsPage 441→269 · **CandidatesPage 674→308** (hooks: data/options/bulk) ·
  **App.jsx 468→71** (appPages-registry + DashboardLayout-shell) · **VacanciesPage 424→275** (hooks).
- **i18n:** shiftmanager-pagina's (Locations/Contacts/Departments) + MonthlyKpiCard + LineChartCard
  vertaald × 5 locales; candidate-area + settings al vertaald.
- **CS-7** (NL-identifiers → Engels): mijn domein clean. **CS-4** (chrome-hex → tokens): per-touch gedaan.
  **CS-9** tests: +41 (`candidatesShared` · `mapCandidate` · order-formatters · filter-builder); **suite 102 groen**.
- **0% mock — shiftmanager:** ContactsPage/LocationsPage/DepartmentsPage/CustomersPage/Dashboard
  gestript → live `sm_`-endpoints. ShiftmanagerDashboard fabriceert niets meer.
- **Backend-integratie (per 2026-06-25):** audit-JSON-blocker **opgelost** (writes/seeds/geo werken) ·
  candidates/applications(+detail)/vacancies/customers/tasks/opportunities/matches/workflows/dashboard
  **✅ live** · `sm_*` volledig + geseed · `/nationalities` gebouwd · **geo (lat/lng + PDOK-geocoding) op
  native candidates+customers gebouwd** (radius-contract: `GET /candidates?lat=&lng=&radius=` of
  `?near_vacancy={id}&radius=`, rijen met `distance_km`).
- **Lookups** via `/settings/candidate-lookups` (statuses/funnel/candidate-types in één call) + losse
  lookup-endpoints. **Pricing/pakketten + Super Admin (modules + `/admin/usage`)** + WhatsApp Business
  (module) + WhatsApp Web (persoonlijk, Profiel) + uitgebreide Audit Log.

---

## 4. HET PLAN — geprioriteerd, concreet, afvinkbaar

> Volgorde = severity dan waarde. Elk item: **wat · waar · done-criterium.**

### P0 — Security & integriteit (eerst, klein maar kritiek)
- 🔴 **D1 auth-drift beslissen** (§2.5): kies Bearer vs httpOnly en **werk CLAUDE.md §7 + de SPECIALIST-
  rol bij** zodat doc=werkelijkheid. *Done = doc en code zeggen hetzelfde + token-opslag geverifieerd
  XSS-veilig (geen localStorage).*
- ☐ **Security-sweep (audit §1):** grep op `dangerouslySetInnerHTML` (sanitized?), tokens in
  `localStorage`/`sessionStorage`, secrets/`VITE_*` in client, PII/IDs in URLs/logs/`console.log`, externe
  `<a>` zonder `rel`. *Done = audit-scorecard Security ✅, findings ≤ LOW.*
- ☐ **`npm audit`** + pin kwetsbare deps. *Done = geen HIGH/CRITICAL advisories.*

### P1 — App op echte data (0% mock) — het strategische doel
- ◐ **Mock-strip entity-pages:** `useCandidatesData` (DUMMY_CANDIDATES) · `applications` (MOCK_APPLICATIONS
  + `buildMockDetail` + MOCK_REJECTION_REASONS in `data/mocks.js`, ApplicationsPage/AddApplicationModal/
  RejectionBlock) · `useVacanciesData` (USE_MOCKS in catch). Customers-native = al clean. *Done = 0×
  USE_MOCKS/DUMMY_*/MOCK_* op die pagina's; lege/foutieve call → lege staat; mocks-files verwijderd.*
- 🔒 **Radius-filter wiren** (D2 besloten — geo-contract klaar): radius-filter op CandidatesPage met
  **anker-keuze: vestiging/plaats (`?lat=&lng=`) óf vacature (`?near_vacancy=`)** + radius-slider (35 km
  default) + `distance_km`-kolom (sorteerbaar). Picker-ankers hebben server-coords → **geen geocoding**;
  vrije-tekst-plaats = later (geocode-endpoint). *Done = server-side `?...&radius=` werkt + distance zichtbaar.*
- ☐ **Mock-restant elders:** WorkflowsPage `MOCK_WORKFLOWS` · WorkflowCanvasEditor `MOCK_LOGS` →
  `/workflows` · `/workflow-runs`. *Done = die fallbacks weg (workflow-editor = afstemmen, §P3).*

### P2 — Modulariteit afmaken (RF-restant + blueprint-conformiteit)
- ☐ **RF > 400 restant splitsen:** `ReportFilterSidebar` 469 · `MessagesTable` 423 · WorkflowCanvasEditor-
  restant 863. *Done = elk single-purpose < ~400; build+lint groen.*
- ☐ **Blueprint-conformiteit per entiteit** (vacancies/customers/applications/matches/opportunities/tasks):
  zelfde shape als candidate (Page·Table·BulkBar·Modal·Drawer + tabs; shared `DataTable`/`InsightsRow`/
  `ActionMenu`/`bulkMutate`). *Done = geen entiteit met een afwijkende eigen vorm; geen 2e MODULE_META.*
- ☐ **AW-5/6** (workflow): LinksTab alle 9 koppel-types (config-gedreven) · WorkflowsPage `StepPill` uit de
  gedeelde registry. **AW-9:** date-veld in editor → datepicker (DD-MM-YYYY).

### P3 — i18n compleet (geen Dutch islands)
- ☐ **Editor-i18n-pass** (workflow-editor ~60 strings, 0×`t()`) + module-registry labels/categorieën +
  `CATEGORY_ORDER` → keys × 5 locales. *Done = audit i18n ✅ op de editor; alle 5 locales in parity.*
- ☐ **Project-brede i18n-grep** op resterende JSX-literals/Dutch islands. *Done = 0 findings.*

### P4 — Kwaliteit & schaalbaarheid (groot, apart inplannen)
- ☐ **CS-6 — inline `api.*` → feature-`api/`-laag** (72 files). Per feature een `api/`-module; componenten/
  hooks roepen die aan, niet `api.get` inline. *Done = geen inline `api.*` in componenten; testbaar.*
- ☐ **CS-5 — PropTypes (minimum) → migreer naar TypeScript** op gedeelde lagen (nu 3/277). **TS is de
  grootste schaalbaarheidshefboom** — begin bij `lib/`, `components/ui/`, de data-mappers/hooks. *Done =
  shared laag getypeerd; nieuwe features in TS.*
- ☐ **CS-9 — tests op kritieke paden** (nu 102): bulk-mutate optimistic/reconcile (RTL `renderHook`) ·
  de andere data-mappers · de vier UI-states per entiteit · auth-gated UI. Elke bugfix krijgt een regressietest.
- ☐ **a11y-pass (WCAG 2.2 AA):** focus-trap+restore in drawers/modals · labels/`aria-label` op icon-knoppen ·
  kleur nooit enig signaal (status = icon+tekst) · contrast ≥ 4.5:1 · keyboard-operabiliteit.
- ☐ **Performance:** route-split (✅ via App-registry) · **virtualiseer grote tabellen** (kandidaten/shifts,
  10k+ rijen @ 50 tenants) · debounce filters · cancel in-flight requests op unmount (grotendeels ✅).

### P5 — Features die het product nog mist (per de chats)
- ☐ **Changelog-tab per entiteit** (`/candidates/{id}/activity` e.d.) — zichtbare, werkende wijzigingslog.
- ☐ **Afspraken/intake** (gestructureerde entiteit) + **appointment-gated funnel-stage** (`requires_
  appointment`-flag, nooit hardcoden welke stage de intake is) + **inconsistentie-flag** als afspraak mist +
  **intake-reporting** (`/reports/intakes`: dag/week/maand × recruiter × branch × source × functie × regio)
  + **intake-agenda**.
- ☐ **CV-builder:** download (mooie CV-stijl met tenant-logo) + **template-builder in Settings** (form-
  builder, 2 accentkleuren, logo uit huisstijl). Profieltekst/Samenvatting erin.
- ☐ **Bulk-acties compleet** (uitbreiden `ActionMenu`/`bulkMutate`, authorization-gated, queue+rate-limit
  waar nodig): owner · tag · pool add/remove · status soft-delete/archiveren+herstellen · funnel-stage ·
  kandidaattype (multi add/remove) · tag verwijderen · **WhatsApp-broadcast** · **beschikbaarheid uitvragen**
  · notitie · **taak/bellijst aanmaken** · koppel aan vacature · **shortlisten/voordragen (e-mail + CV)** ·
  **inplannen op shift (alleen bij planning-module)** · sollicitatie-stage · consent/bewaartermijn.
- ☐ **Backoffice-koppeling (HelloFlex/ShiftManager)** voor matches → placement: **manueel · bulk · workflow**,
  alle authorization-gated; bulk via **queue + rate-limit (HelloFlex)**, GUID naar mapping-tabel, en
  **koppelfout + reden op de kandidaat** tot opgelost. Subtiel icoon = backoffice-gekoppeld.
- ☐ **E-mail-koppeling → Settings, per context** (kandidaten/klanten/planning; Office365/Gmail/SMTP +
  handtekening). **Besloten** model (D3 = alleen UI-plek). Verhuis `ProfileEmailConnect` Profiel→Settings,
  wire `/settings/email/oauth/{context}` (wacht op `…/status`-endpoint).
- 🔒 **Native planning-module** (Orders·Shifts·ScheduledShifts + inroosteren + geo-radius open diensten +
  rooster mailen + favoriet/blacklist) — **BACKLOG** (besloten 2026-06-25). Read-only SM-variant
  (`/sm_orders /sm_shifts /sm_schedule`) bestaat; planning-tab-wiring = backlog.
- 🔒 **Workflow-graaf (C-27):** backend rework `step_order` → `position`+`connections[]` met **stabiele
  step-id's**; dan FE-editor de echte graaf laten opslaan/laden (nu lineair/mock).

---

## 5. Open beslissingen (Danny) ⚠️
| # | Vraag | Opties | Aanrader |
|---|---|---|---|
| **D1** | Auth-model | ~~(a) Bearer + harden · (b) httpOnly-cookie-SPA~~ | ✅ **BESLOTEN (b) httpOnly-cookie (Sanctum SPA)** 2026-06-26 → N-2 + BE-8 |
| **D2** | Radius-anker | ~~(a)/(b)/(c)~~ | ✅ **BESLOTEN: beide ankers, elk op zijn eigen scherm** — kandidatenlijst meet vanaf **vestiging/plaats** (`?lat=&lng=`), vacature/match-scherm vanaf **vacature** (`?near_vacancy=`). Picker-ankers = server-coords (geen geocoding) |
| **D3** | E-mail-UI-plek | ~~sub-tab vs sectie~~ | ✅ **AL GEBOUWD: per-context sub-tabs in Settings**; Profiel = aparte persoonlijke mailbox (blijft). Rest = i18n (66 registry-labels, FE-P3-3) + BE-2 `…/status` |
| **D4** | TypeScript-migratie | nu starten (shared laag) vs later | **nu** beginnen bij `lib/`+`components/ui/` — grootste hefboom |
| **D5** | Native planning-module | nu bouwen vs backlog houden (read-only SM nu) | **backlog** (jouw besluit); heropenen na klantportaal+kandidaat-app |

## 6. Backend-coördinatie (wat backend nog levert) 🔒
- **Sanctum SPA-cookie (BE-8, D1):** stateful-domains, CORS `credentials:true`, `/sanctum/csrf-cookie`,
  Secure+SameSite — daarna FE-flip (N-2) · `GET /settings/email/{context}/status` (na D3) · **C-27
  graaf-rework** (workflow) · webhook-delivery (C-5b stap 2) · intake/afspraken-endpoints
  (`/reports/intakes`, appointments) · dashboard-KPI-**deltas** (subs zijn nu `null`) · yesway
  **PDOK-backfill** samen draaien (AVG-go gegeven). Volgorde-advies: **C-27** + **BE-8** parallel.

## 7. Multi-Claude & git-discipline
- Alles op **main** (geen branches). **Vóór elke edit `git status`**; raak nooit andermans ongecommitte WIP
  aan (stil overschrijven = onomkeerbaar). Push-flow: `git pull --rebase --autostash` → `git push`. Commit
  alleen je **eigen** files bij naam (geen `git add -A` tenzij Danny "checkpoint" zegt). Build+lint **groen**
  (0 errors) vóór commit — "build groen ≠ correct, lint is de vangrail". Backend = aparte repo (out of scope).

## 8. Folder-doel (langere termijn, §2 CLAUDE.md)
`app/` (shell/providers/router) · `pages/` (thin) · `features/<domain>/{components,hooks,api,utils,index.js}`
· `components/` (shared dumb UI) · `hooks/` · `contexts/` · `lib/` · `config/` · `locales/` · `styles/`.
Drawers leven nu onder `pages/<entity>/`; migreer richting `features/` per touch.

## 9. Self-Audit (na ELKE deliverable — verplicht)
```
### Self-Audit
- Files touched: <list> — largest: <name> (<lines>/1000)
- Modularity: <single-purpose? logic in hooks?>
- i18n: <all strings via t()? all 5 locales?>
- a11y: <keyboard? labels? contrast?>
- Security: <no secrets? token handling? no dangerous HTML? no PII logged?>
- Performance: <split/virtualized where needed?>
- Tests: <covered / still untested>
- Consistency: <matches blueprint/patterns?>
- Risks / TODO: <honest, or "none">
```

---

### Eerstvolgende uitvoervolgorde (concreet)
1. **P0** security-sweep + D1 auth-drift reconcilen.
2. **P1** entity-mock-strip (candidates/applications/vacancies) → 0% mock; daarna radius wiren (na D2).
3. **P2** RF-restant splitsen + blueprint-conformiteit verifiëren.
4. **P3** editor-i18n. **P4** CS-6 → TS-start → tests/a11y. **P5** features op volgorde van klantwaarde.

> **De afvinkbare "doe-dit-nu"-board hiernaast = [`MASTER-WORKLIST.md`](./MASTER-WORKLIST.md)** (wie/wanneer).
> Detail per bevinding blijft in `architect-Worklist.md` (AW/CS/RF/DS/DUP/VOC) en backend-werk in
> `worklist.md` (C-items). **Dit bestand = de strategie/waarom; de worklist = de uitvoering.**
