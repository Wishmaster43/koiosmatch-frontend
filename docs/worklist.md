# Koios Match — Werklijst

> **DE ene levende bron.** Alleen open taken. Specs staan in CLAUDE.md §3B of in een C-item hieronder.
> Architectuur-bron = `docs/ARCHITECTURE.md`; regels = `CLAUDE.md`. Verder geen losse worklists meer.
> **Bijgewerkt:** 2026-06-29 — file-by-file audit gefold in §G; zie ook `docs/AUDIT.md` (bewijslast),
> `docs/DATA-API.md` (mock + CRUD-matrix), `docs/DECISIONS.md` (keuzes + SaaS-schaalbaarheid 10→1M).
>
> **2026-06-29 [FE]:** kandidaat-lookups nu volledig uit de API — note-types/document-types/cv-template
> ontkoppeld van hardcode + planning-mock weg; backend moet endpoints + seed leveren → **C-37 / C-38**.
>
> **Legenda:** ☐ open · ◐ deels klaar · ✅ klaar · 🔴 blokkerend · [D] Danny · [FE] Frontend · [BE] Backend

---

## A. Danny — beslissingen nodig

- [ ] **A-1** [D] Kandidaat drawer hertekenen (plan klaar, sessie 2026-06-24): 6 tabs + subtabs. Goedkeuren?
- [ ] **A-2** [D] "Kans" = sales-deal (lezing a, huidig) of open vacature/positie (lezing b)? Bepaalt het datamodel.
- [ ] **A-3** [D] Handmatig status `matched` zetten → prompt om Match te koppelen? Of gewoon toestaan + inconsistentie-vlag?
- [ ] **A-4** [D] Hosting WhatsApp-gateway: Hetzner (EU, goedkoop) vs. strikt NL (premium)?
- [ ] **A-5** [D] Terminologie definitief: "vacancy" of "vacature"? Consistent doorvoeren.
- [ ] **A-6** [D] Adres bij locaties: huidige compacte weergave ok, of anders?
- [ ] **A-7** [D] Module Taken verplicht voor auto-taken in workflows? (lijkt ja)
- [ ] **A-8** [D] Waar leeft de "weer-beschikbaar-actie": workflow of settings?
- [ ] **A-9** [D] Welke kanalen default voor afwijzing/benadering (e-mail / WA Business / WA privé)?

---

## B. Frontend — open taken

### 🔴 B-A1 · Kandidaat drawer hertekenen (nieuw plan 2026-06-24)
Volledig nieuwe tabstructuur. **Wacht op A-1 (Danny akkoord).**

**6 hoofdtabs + subtabs:**
1. **Profiel** — subtabs: Persoon · Contact · Achtergrond · Profieltekst
2. **Werk & Planning** — subtabs: Inzetbaarheid · Voorkeuren · Sollicitaties · Matches
3. **Communicatie** — subtabs: Berichten (Email + WA Business + WA Privé, één stroom) · Notities · Opt-ins
4. **Documenten** — plat, geen subtabs
5. **Koios AI** — advies + signalen + statistieken
6. **Tijdlijn** — read-only feed (statuswijzigingen + alle contact-events)

`last_contact_at` + `last_contact_type` automatisch bijgewerkt bij elk bericht.

### B-A1.1 · Kandidaat drawer — subtab Persoon
Bevat: naam, geslacht, geboortedatum, geboorteplaats, nationaliteit, profielfoto.

### B-1 · E-mail per context
Settings-UI: 4 panelen/tabs, provider-keuze, handtekening-editor, default-fallback. Backend klaar.

### B-2 · Koios AI — verbruik + super admin
- Scherm C: verbruik per gebruiker/type (`GET /ai/koios/usage`)
- Scherm D: super-admin overzicht (`/admin/usage` + `/admin/prompts`)
- Paperclip/upload in de chat
- Hangt op: backend veldnamen bevestigen

### B-3 · Bulk-acties fase 2
- Tag toevoegen (creatable, nu alleen verwijderen werkt)
- Koppelen aan vacature (bulk → maakt sollicitatie, geen auto-e-mail)
- Vestiging/branch koppelen
- Hangt op: C-15 (array-uitbreiding)

### B-6 · Webhooks filter-UI
Live testen zodra `/webhook-subscriptions` + `/webhook-events` bestaan (C-5b).

### B-7 · WhatsApp Web (persoonlijk) — live verifiëren
Frontend gebouwd; endpoints wachten op gateway.

### B-8 · Sollicitatie-tab op de kandidaat
Match-score + AI-afwijsreden + bewerkbare funnel-fase per sollicitatie.
Hangt op: B-2, C-23 (applicaties detailshape).

### B-9 · Profiel — gekoppelde rollen + persoonlijke e-mail
Rollen tonen + Gmail/O365/SMTP koppeling.

### B-10 · Status/funnel-model doortrekken (frontend)
- `is_applicant`-gating opruimen
- `status==='intake'` vervangen door afspraken-KPI
- Hangt op: C-10

### B-12 · Messaging-schermen afronden
Shapes verifiëren + outreach-conversiewidget bouwen.
Hangt op: C-13 (shapes + outreach-endpoint)

### B-13 · Functie-toggle uitrollen
Toggle dropdown↔vrij + strict-guard werklijst in Settings → Personalisatie → Functies.
Hangt op: C-14 (klaar, maar toggle-UI nog te bouwen)

### B-14 · Audit log uitbreiden
Entiteit/IP-kolom + entiteit-filter + per-kandidaat changelog live.
Hangt op: C-16

### B-17 · Afspraken/Intakes
- Afspraken-sectie/tab op de kandidaat
- Inconsistentie-signaal (fase vereist afspraak, maar geen geplande)
- Intake-rapport + agenda-overzicht
- Hangt op: C-22

### B-18 · Sollicitaties — drawer tabs + AI-beoordeling + afwijzing
6 tabs vullen + MatchScoreBlock + RejectionBlock + beoordelingscriteria-settings.
Hangt op: C-23/C-24/C-25

### B-19 · Vacatures — feature-refactor naar candidate-blueprint
Monoliet VacanciesPage.jsx herbouwen. Hangt op: C-26

### B-20 · Taken — feature naar candidate-blueprint
Kanban + drawer + settings-lookups. Hangt op: C-18

### B-21 · Aangepaste velden — generiek over 8 entiteiten
CustomFieldsEditor + CustomFieldsTab per entiteit. Hangt op: C-29

### B-22 · Dashboard de-hardcoden
Alle hardcoded arrays vervangen door live API-calls. Hangt op: C-30 + C-26 + C-18

### B-23 · Dashboard visueel herontwerp
Charts, hero-tijdreeks, funnel, donuts. Hangt op: B-22 + C-31

### B-26 · Pakket-/module-herstructurering ◐
FE-stappen 1–6 klaar. Open: `GET /admin/usage` (alle-klanten-overzicht).
Hangt op: C-32

### B-27 · Rol-gebaseerd operationeel dashboard
7 templates, `useDashboardLayout()`, blokken als losse componenten.
Hangt op: C-34 + C-35

### B-28 · Rapporten-hub (analytisch)
5 sub-tabs, per-tab autorisatie. MVP = Kandidaten/instroom-uitstroom tab.
Hangt op: C-34

### B-29 · RolesSettings — dashboard-template picker + preview
Template-picker + live miniatuur mockup in rol-detail.
Hangt op: C-35

---

## C. Backend — open taken

### 🔴 C-0 · Volledige seeder (Yesway + demo)
Alle lookups + realistische sample-data voor beide tenants. Geen lege schermen meer.

### 🔴 C-10 · Status/funnel-model reseed
Status herseed naar: `lead · candidate · matched · inactive · unplaceable`.
Blacklist = aparte vlag. Archived = soft-delete.
Details + afstemming: zie originele spec in git-history.

### C-1 · Lookups — "in gebruik"-vlag + 409 ◐
Verifiëren met ingelogde sessie: vacancy status/fase toevoegen + reorder werkt.

### C-2 · Kandidaat sub-entiteiten — body-contracten
Sub-entiteit CRUD (experiences/educations/certifications/skills/matches/languages/preferences/zzp).

### C-4 · Kandidaat — Branches koppelen
`POST /candidates/{id}/branches { customer_id }` + DELETE + GET-detail `branches: [{ id, name }]`.

### C-5b · Uitgaande webhooks
`/webhook-subscriptions` + `/webhook-events` (404 → nog te bouwen).

### C-6 · Locaties — gestructureerde velden
Volledige velden op `POST/GET /locations` (straat/huisnr/postcode/etc.).

### C-7 · `/industries` lookup
CRUD-lookup geseed met defaults. Fix: dropdown en beheersectie lezen dezelfde bron.

### C-8 · `placements` → `matches` hernoemen
Relatie/route/resource hernoemen.

### C-11 · Kandidaat — kanaal-consent (opt-in)
`PATCH /candidates/{id}` met `consent: { whatsapp_opt_in, email_opt_in, newsletter_opt_in }` + tijdstip/bron bewaren.

### C-13 · Messaging-shapes + attention-tiles
Shapes bevestigen + `no_followup_planned` + `active_conversation` + outreach-shape leveren.

### C-15 · Bulk-mutaties — array-uitbreiding
`POST /candidates/bulk/candidate-type` moet `candidate_types: []` (array, REPLACE) accepteren.

### C-16 · Audit log — meer dekking
Subject-velden mee in `/activity-log` + `GET /candidates/{id}/activity`.

### C-18 · Taken — tabellen + endpoints + seeder
Volledige taken-feature (kanban, lookups, comments, seeder).

### C-19 · Matches — tabel + endpoint + seeder
`/matches` als eigen tabel of view over applications? Bevestigen.

### C-20 · Applications — seeder + `match_score`
Seeder ~10 sollicitaties + `match_score` kolom.

### C-21 · Kandidaten-velden + lookups + soft-delete
`/last-contact-types` + `/note-types` + seeder last-contact-at/-type + `place_of_birth` + `facebook_lead_id` + individuele soft-delete met preflight.

### C-22 · Afspraken/Intakes
`requires_appointment`-vlag + `appointments`-entiteit + `GET /reports/intakes`.

### C-23 · Alle kandidaat-velden leveren
API levert alle velden uit `mapCandidate.js`. Seeder vult ze realistisch.

### C-26 · Vacatures — tabel + endpoints + bulk + seeder
30 dummy-vacatures, lookups, bulk, koppeling sollicitaties.

### C-27 · Klanten — endpoints + sub-entiteiten + seeder
Volledige CRUD + locaties/afdelingen/contactpersonen + 15–20 klanten geseed.

### C-29 · Aangepaste velden — 8 entiteiten
Definitie-endpoints + `custom_fields` JSON per entiteit.

### C-30 · `GET /dashboard` summary-endpoint
KPIs + recents + filterbronnen in één call.

### C-31 · Dashboard charts-data
Tijdreeksen + verdelingen + funnel voor grafieken.

### C-32a · Afwijzing via workflow — event-trigger + queue
`application.rejected` event + workflow-trigger + multi-kanaal-bericht + tokens.

### C-32b · Pakket-/module-model
3 pakketten + add-ons + `GET /admin/tenants/{id}/usage`.

### C-33 · `ui_preferences` op users
JSON-kolom + `GET /auth/me` levert hem + `PATCH /users/{id}` accepteert hem.

### C-34 · Dashboard + Rapporten endpoints
`GET /dashboard` + `GET /reports/flow|recruiters|intakes|vacancies|matches`.

### C-35 · `dashboard_type` op rollen
Kolom + seed 7 standaard-rollen + `GET /auth/me` geeft `roles[].dashboard_type`.

### C-36 · Kandidaat-instellingen + voorkeuren — endpoints, opslag, seed (FE klaar · BE: lookups gedicht, opslag open)
De **frontend is volledig** voor candidaat-instellingen + Voorkeuren-tab; wat nog mist is **uitsluitend
backend** (resterende opslag). Dagen = vaste Intl-lijst (géén API). Lookups zonder data → drawer valt
fail-soft terug op de FE-seed.

**(a) ✅ `/driver-licenses`** — live op demo+yesway (tabel + 15 NL-categorieën, zit in `CandidateLookupSeeder`
→ `dev:reset` vult het). Settings-editor én drawer lezen nu echte data. (BE-Claude, 2026-06-27)
**(a2) ✅ `/candidate-rejection-reasons`** — 7 standaardredenen live geseed (idempotent). ⚠️ Reproduceer-eindje:
zit nog in **géén** seeder → BE voegt ze toe aan `CandidateLookupSeeder` zodat `dev:reset` ze ook vult.

**(b) Lookup-CRUD-contract dat élke candidate-settings-editor verwacht** (`StatusListEditor` /
`CandidateLookupsSettings`): `GET` · `POST` · `PUT /{id}` · `DELETE /{id}` (409 + `in_use`-vlag als
referenced) · `PUT /{id}/reorder` (of `/reorder` met `{ ids: [] }`). Alle moeten **geseed** zijn,
anders toont de editor niets en valt de drawer terug op de FE-seed. Endpoints die de candidaat-
instellingen raken: `/genders` · `/functions` (+`allow_free_entry`) · `/industries` (C-7) ·
`/driver-licenses` (✅ live) · `/languages` + `/language-levels` · `/availability-options` ·
`/last-contact-types` + `/note-types` (C-21) · `/pools` · `/settings/candidate-lookups/{statuses,
candidate-types,funnel-types}` (C-1/C-10).

**(c) Preferences-opslag** — `PATCH /candidates/{id}` met de **`preferences` JSON** (FE stuurt de hele
blob). Velden: `preferred_days[]` · `function_pref` · `sector_pref[]` · `license_categories[]`
(**vervangt** `has_license` bool) · `wage_tax` (bool) + `wage_tax_from` (date) · `available_from` ·
`hours_per_week` · `max_travel_km` · `max_travel_min` · `own_transport` · `remarks` (HTML-rich-text).
`preferred_days` / `sector_pref` zijn nu **arrays** (waren string).

**(d) `/settings`-keys** (merge-by-key, tenant weergave-voorkeuren kandidatentabel):
`candidate_table_color_funnel` / `_type` / `_pool` / `_koios` (bool, default uit) ·
`candidate_table_color_status` (bool, **default aan**) · `candidate_table_color_owner` (bool, **default aan**) ·
`candidate_avatar_colored_by_gender` (bool, default uit).
⚠️ **Booleans als `true`/`false` opslaan** (string of echte bool) — **niet** `1`/`0`. De FE leest booleans
strikt als `true`/'true' (consistent met de toggle); een `1` wordt als *uit* gelezen → toggle-uit maar
tóch gekleurd-bug. Seeder/migratie dus met `true`/`false`.

**(e) Migratie:** bestaande `has_license`-data → `license_categories[]`.

### C-37 · Kandidaat — laatste hardcoded lijsten ontkoppeld (FE klaar · BE: endpoints + seed)
De frontend haalt nu **alles** rond kandidaten uit de API; deze drie endpoints/keys moeten
backend-zijdig nog bestaan + geseed worden. Tot die tijd valt de FE fail-soft terug op een seed.

**(a) `/note-types`** (lookup-CRUD-contract C-36b, **geen kleur** nu — `withColor={false}`). Seed 6
standaarden in `CandidateLookupSeeder`: `Algemeen · Intake · Feedback · Afspraak · Follow-up ·
Waarschuwing`. Opgeslagen op de notitie als `type` (value/slug). FE: `useNoteTypes()` +
`NoteTypesSettings` (bestond al). *(Optioneel later: kleurkolom → dan note-chips gekleurd; FE
ondersteunt `color` al.)*

**(b) `/document-types`** *(NIEUW)* — lookup-CRUD-contract C-36b **mét kleur** (`color`-kolom, hex of
`var(--color-*)`). Seed 7 standaarden + kleuren: `CV`(secondary) · `ID-bewijs`(#8B5CF6) ·
`Diploma`(warning) · `Contract`(#059669) · `VOG`(danger) · `Certificaat`(#EC4899) · `Overig`(#6B7280).
Opgeslagen op het document als `type` (value/slug). FE: `useDocumentTypes()` (label+kleur) +
nieuwe `DocumentTypesSettings`-subtab (Personalisatie → Kandidaten).

**(c) `candidate_cv_template` in `/settings`** — CV-template-config verhuisd van browser-`localStorage`
naar de tenant-`/settings`-blob (was per-device, nu per-tenant; AVG/§7). JSON-waarde:
`{ primaryColor, secondaryColor, logoUrl, companyName, sections[] }`. Werkt via de generieke
merge-by-key `/settings` (C-36d) — alleen bevestigen dat de key meekomt in GET/POST.

### C-38 · Overzicht — wat backend nog mist voor de **complete** kandidaat (table · drilldown · settings)
Geen nieuw werk, een **kaart** zodat BE-Claude de hele kandidaat in één blik ziet (verwijst naar
bestaande C-items):
- **Tabel/KPI-row:** `GET /candidates/stats` (server-brede tellingen per status/funnel/recruiter/
  niet-gecontacteerd/intake-gepland/taken — niet paginabreed) · `last_contact_at`/`_type`-kolommen +
  `facebook_lead_id` (C-21) · soft-delete-filters (inactief/blacklist/archived standaard uit, C-21).
- **Drilldown (drawer):** sub-entiteit body-contracten (C-2) · álle kandidaat-velden incl.
  `place_of_birth` (C-23) · Matches read-only (C-19) · Sollicitaties-funnel (C-23) · Changelog
  `/candidates/{id}/activity` (C-16) · Afspraken/Intakes + `requires_appointment`-vlag (C-22) ·
  kanaal-consent `*_opt_in` (C-11) · documenten-upload + `type` via `/document-types` (C-37b) ·
  note-types (C-37a) · branches (C-4).
- **Settings:** álle lookup-CRUD-contracten geseed + 409/`in_use` + reorder (C-36b) · `/note-types`
  (C-37a) · `/document-types` (C-37b) · `candidate_cv_template` (C-37c) · tabel-kleur-`/settings`-keys
  met booleans als `true`/`false` (C-36d).

### C-27-workflow · Workflow-modules — graaf-opslag
Steps opslaan met `position` + `connections[]` (target + filters). Stabiele step-ids.

---

## E. TypeScript-migratie (FE — ✅ klaar in eigen domein)

> Hele repo → TS, **groen per golf** (`typecheck`+`lint`+`build`+`test`), incrementeel op main.
> Nieuw bestand = altijd `.ts`/`.tsx`. **Candidate-/settings-mappen + `Sidebar.jsx` = andere Claude (afblijven).**

**✅ Klaar (gepusht):** `lib/` · `context/` · gedeelde blueprint (drawer/forms/insights/charts/settings-views) ·
candidate-feature · alle 6 entity-features (customers/applications/vacancies/tasks/opportunities) +
modules-registry · auth · reports (18) · matches · whatsapp · dashboard · planning · ai (8) · koios (7) ·
layout-shell (DashboardLayout/TenantSwitcher/appPages) · workflow-serialization · shiftmanager 26/26 ·
**E-2 workflow-editor-core (WorkflowCanvasEditor + canvas/fields/ScheduleModal/contexts)** ·
**shiftmanager charts/orders-cluster (10)** · **app-shell (App/main/i18n)** · **users (UsersPage/NewUserModal)** ·
**C-35-prep (dashboard_type op rol-shape + `dashboardType()`-helper, backward-compatible)**.
Types in `src/types/*` (api+ManagedUser · candidate · application · vacancy · customer · opportunity · task ·
reports · match · whatsapp · dashboard · planning · workflow · ai · koios · shiftmanager).

**🗑️ Dode code verwijderd:** `components/workflows/{ScheduleSettings,scheduleEditors}.jsx` (vervangen door
`layout/workflow/ScheduleModal.tsx`) · `theme/BrandTheme.jsx` (huisstijl loopt via CSS-vars, 0 importers).

**☐ Resterend (buiten mijn domein):** `settings/` (~70 files) + `Sidebar.jsx` = andere Claude · `test/setup.js`
blijft test-infra (`.js`). **In het frontend-domein is de migratie hiermee rond.**

**Patroon-notities:** dynamische-key-sort → `(av as number)`-cast · losse API-payloads → permissieve
interfaces met index-sig (**geen `any` in datamodellen**) · `useAuth() ?? {}` · JS-boundary-componenten
`as unknown as ComponentType<…>` · filter(Boolean) → `.filter((x): x is string => Boolean(x))` ·
recharts-props uit publieke types geomit (Legend `payload`) → `@ts-expect-error` met reden ·
`ShiftFilterGroup` index-sig zodat 'ie naar RightPanel's `Record<string,unknown>` mag.

**Na de migratie (besloten volgorde 2026-06-27):** (1) audit-convergentie-loop tot 0 findings → (2) refactor
de >400-splits (§F-1) → (3) `/architect` tegen ARCHITECTURE.md → (4) CLAUDE.md harden naar master-standaard.

---

## F. Kwaliteit & architectuur (FE — gefold uit MASTER-PLAN P2–P4 + architect-findings)

### Modulariteit
- ☐ **F-1** Splits > ~400 r: `ReportFilterSidebar` (490) · `MessagesTable` (423) · `WorkflowCanvasEditor` (878) → elk single-purpose < ~400.
- ☐ **F-2** Blueprint-conformiteit per entiteit (vacancies/customers/applications/matches/opportunities/tasks = zelfde shape als candidate; gedeelde DataTable/InsightsRow/ActionMenu/bulkMutate; geen 2e MODULE_META).
- ☐ **F-3** DUP: `shiftmanager/CustomersInsightsRow` = near-duplicate van gedeelde `InsightsRow` → samenvouwen. AW-9: editor-datumveld → datepicker (DD-MM-YYYY).

### i18n compleet (geen Dutch islands)
- ☐ **F-4** Workflow-editor (~60 strings, 0×`t()`) + module-registry labels/categorieën × 5 locales.
- ☐ **F-5** Settings `registry.jsx` (66 hardcoded nav-labels, 0×`t()`) → `t()` × 5 locales.
- ☐ **F-6** `AppsContext` NL-descriptions · `ViewConfigEditor` EN-strings → via `t()` × 5 locales.
- ☐ **F-7** Project-brede i18n-grep op JSX-literals → 0 findings. VOC-restant: CompanySettings-lijsten + SM-statussen → lookups.

### Kwaliteit & schaalbaarheid
- ☐ **F-8** CS-6: inline `api.*` → feature-`api/`-laag (~72 files).
- ☐ **F-9** CS-9: tests op kritieke paden (bulk-mutate optimistic/reconcile, mappers, 4 UI-states, auth-gated UI).
- ☐ **F-10** a11y WCAG 2.2 AA: focus-trap+restore drawers/modals · aria-labels op icon-knoppen · kleur≠enig-signaal · contrast ≥4.5:1.
- ☐ **F-11** Virtualiseer grote tabellen (kandidaten/shifts, 10k+ rijen).
- ☐ **F-12** DX: dev-only API-foutmelding (METHOD url→status) · silent `.catch(()=>{})` → min. dev-log · duidelijke user-facing error-states i.p.v. lege schermen.

### Auth-flip (gated op backend)
- ☐ **F-13** N-2: Sanctum httpOnly-cookieflow aanzetten (`withCredentials` + CSRF-priming, Bearer-localStorage uitfaseren) — **pas flippen ná de gecoördineerde backend-deploy** (BE-8). FE-scaffold (`VITE_COOKIE_AUTH`) bestaat.

---

## G. Audit-findings (file-by-file, 2026-06-29)

> Bewijslast in `docs/AUDIT.md`. Geprioriteerd; **FE** = ik fix in de convergentie-loop · **BE/2e-Claude** =
> handoff. Volgorde van uitvoeren: **P1-FE-veilig → R-splits (F-1) → her-audit → herhalen → CLAUDE.md harden**.

| ID | Sev | Eff | Eigenaar | Item |
|---|---|---|---|---|
| **I18N-1** | P1 | **XL** | FE | **Workflow-registry-i18n (eigen workstream).** Niet alleen ~56 module-labels + ~16 categorieën, maar **élk** schema-veld-label ('Status'/'Filters'/'Max. resultaten'/'Welke records?'/…) + action-/option-waarden ('Ophalen'/'Aanmaken'/…) — honderden strings × 5 locales. §5 = **compleet of niet** → 1 gefocuste sessie. Bouw `t('modules:labels.<type>')` + `categories.<key>` + `fields.<key>`; registry levert nl-bron, geen twee-waarheden. |
| **I18N-2** | P1 | L | FE | `WorkflowCanvasEditor` + `ScheduleModal`/`fields` chrome-strings ("Module kiezen"/"Opslaan"/"Laden…"/CATEGORY_ORDER) — samen met I18N-1 in de workflow-i18n-sessie. |
| **MOCK-1** | P1 | M | BE+2e | kandidaat-Planning-tab op `data/mocks.ts` → planning-endpoints + hooks |
| **F-13** | P1 | M | FE (gated) | `auth_token`/`auth_user` uit `localStorage` → httpOnly-cookieflip (ná backend-deploy) |
| **D-1** | P1 | M | BE+FE | changelog (`/activity`) op customers/vacancies/applications/tasks/opportunities |
| **D-2** | P1 | M | BE+FE | soft-delete (archive) op tasks/opportunities/applications |
| **F-11** | P1 | L | FE | lijst-virtualisatie (kandidaten/shifts, 10k+ rijen) — schaal-blocker |
| **I18N-3** | ✅/2e | — | 2e | FE-domein geverifieerd clean (dumb/wrappers, tekst via props). Residu = `settings/*` (2e-Claude). |
| **CFG-1** | P2 | M | BE+FE | NATIONALITIES/LANGUAGES/klant-STATUSES → tenant-lookups + i18n |
| **D-3** | P2 | M | BE+FE | "gearchiveerd bekijken + herstellen"-UI |
| **D-4/D-5** | P2 | S | BE+FE | tasks `/stats` + `/tasks/{id}/activity` |
| **R-SPLIT** | P2 | M | FE | ✅ `ReportFilterSidebar` 485→216(+2) · ✅ `MessagesTable` 430→250(+2) · ✅ `fields` 403→124+290 · ◐ `WorkflowCanvasEditor` 907→**520** + 3 panels (ModulePicker/ConfigPanel/LogsPanel) ✅; rest = `useWorkflowEditor`-hook (EditorInner-state/handlers → main <400) — fold in workflow-i18n-sessie |
| **DUP-1** | P3 | S | FE | ✅ avatar-kleur 3× → `lib/avatarColor` |
| **A11Y-1** | P2 | M | FE | ~28 modals/drawers zonder focus-trap/`role=dialog`/`aria-modal`+restore (§6) — alleen `ChangelogPopover` heeft 't. Shared `Drawer`/`Modal`-shell met focus-trap. |
| **A11Y-2** | P2 | M | FE | icon-only buttons missen `aria-label` (34/359) — X-close/sort/chevron/trash. |
| **ERR-1** | P2 | M | FE | 94× silent `.catch(()=>{})` → min. dev-log + user-facing error-state (= F-12). |
| **F-8** | P2 | L | FE | 53 componenten fetchen inline (`api.get`+`useEffect`) → naar feature-hooks (§3). |
| **DUP-2** | P3 | S | FE | herhaalde className-shells (drawer ×10 · table ×7 · card ×6 · error-banner ×6) → extract; error-banner + card gebruiken rauwe Tailwind-kleuren i.p.v. `--color-*`-tokens (§4). |
| **F-12b** | P3 | L | FE | deep-relative-imports (`../../`, ~589 warnings) → `@/`-alias |
| ~~USE_MOCKS~~ | ✅ | — | — | DATA-API-zorg opgelost: `USE_MOCKS` is DEV-gated (`import.meta.env.DEV`), shipt nooit in prod. |

> **Positief bevestigd** (geen findings): geen `console.log` in commits · geen ongesanitiseerde dangerous HTML
> (`SafeHtml` saniteert) · geen hard-delete-call in FE (§8) · types zonder `any` in datamodellen.

### Runbook — workflow-sessie (turnkey, 1 gefocuste pass)

**Stap 1 — split `WorkflowCanvasEditor.tsx` 907 → <400 (pure refactor, 1 groene commit):**
- `workflow/ModulePicker.tsx` ← `CATEGORY_ORDER` + `ModuleMetaEntry` + `ModulePicker` (~115r). Props: `{ insertAfterEdgeId, onSelect, onClose }`. Deps: `MODULE_META`/`MODULE_APP_MAP`/`useApps`.
- `workflow/ConfigPanel.tsx` ← `MANAGE_TABS` (export) + `ConfigPanel` (~145r). Deps: `MODULE_META`/`MODULE_SCHEMAS`/`FieldInput`/AI-tabs.
- `workflow/LogsPanel.tsx` ← `LogsPanel` (~95r). Deps: `api`/`runFormat`/`RunRow`. (Meest zelfstandig → eerst.)
- `workflow/useWorkflowEditor.ts` ← `EditorInner`-state + alle callbacks (`handleEdgeAdd/Delete/Filter`, `saveEdgeFilter`, `handleNodeRun`, `onConnect`, `insertModule`, `updateNodeConfig`, `deleteNode`, `handleSave`, `handleRun`, `nodesWithFirst`, `firstNodeId`) (~210r). Retourneert state + handlers.
- `WorkflowCanvasEditor.tsx` ← `EditorInner` JSX die de hook gebruikt + de 5 context-providers + `ReactFlowProvider`-wrapper (~280r).

**Stap 2 — I18N-1/2 (§5-compleet, 1 groene commit):** nieuwe `modules`-namespace (nl-bron + en/de/fr/es):
`labels.<type>` (~56) · `categories.<key>` (~16, key = slug van CATEGORY_ORDER) · `fields.<key>` (schema-veld-labels) ·
`actions.<key>` (Ophalen/Aanmaken/…) · `editor.*` (chrome: "Module kiezen"/"Opslaan"/"Laden…"/"Aan"/"Uit"/…).
Render: `MODULE_META`-bouw in `modules/index.ts` levert `type` als key; resolve labels/categories/fields **at render**
via `t('modules:…')`; **registry-strings blijven de nl-bron, géén twee-waarheden**. Wire de FieldInput-`field.label`
+ ScheduleModal + ModulePicker/ConfigPanel-chrome.

**Stap 3 — CLAUDE.md harden** naar master-standaard (na 0 FE-findings).

---

## D. Afgerond (archief)

- C-11 consent (FE, 2026-06-27): kanaal-consent omgezet naar het backend-contract — genest
  `consent.{whatsapp,email,newsletter}_opt_in` (was flat `*_consent`), defaults wa/e-mail aan
  (opt-out) + nieuwsbrief uit, `_consent_at` server-gestempeld (FE stuurt het nooit mee). Type +
  mapCandidate + buildCandidatePatch + CommunicationTab + tests bijgewerkt.
- C-16 changelog-IP (FE, 2026-06-27): `GET /candidates/{id}/activity` levert nu `subject_*` + `ip`;
  changelog-popover toont "Gewijzigd vanaf IP …" per entry (i18n in 5 locales). T3.3 (access-log
  filter) optioneel/niet gebouwd; C-23 owner-kleur vereiste geen actie.
- i18n-audit + parity-aanvulling (2026-06-27): de/fr/es waren ~1833 key-slots incompleet (5 hele
  namespaces + settings + partiële gaten) → stille NL-fallback in de switcher. Alle 5 locales nu **100%
  parity** (audit-script op 0). ⚠️ de/fr/es zijn **machine-vertaald** — aanrader: native reviewer laat
  applications/vacancies/tasks/opportunities/settings nalopen.
- Kandidaat-drawer herstructurering (sessie 2026-06-26): Documenten = eigen tab · Wijzigingslog =
  History-popover in de title-row · Taal→Achtergrond · Kandidaat-type→Voorkeuren · Laatste contact→
  Communicatie · Werk→"Match" (alleen bij match/sollicitatie) · dubbele sollicitatie-chips uit header ·
  ZZP-tab gekoppeld aan candidate-type `freelance` · Statistiek: Recente activiteit weg · ZZP-velden
  opgeschoond · Voorkeuren-refactor (één state: dagen/functie/branche/rijbewijs als chips/dropdown +
  loonheffing). Backend-restpunten → C-36.
- Tabelweergave instelbaar (Settings → Kandidaten → Tabelweergave): gekleurde labels aan/uit + avatar
  1-kleur vs. per-geslacht (fixt blauw-bug) · tabel-waarden uniform (alles zoals Functie). Backend → C-36.
- ShiftManager-pagina's op directe endpoints (`/sm_locations`, `/sm_departments`, `/sm_contacts`)
- Kandidaat-blueprint (CandidatesPage/Table/BulkBar/Drawer + rust-redesign)
- Status/funnel-model bevestigd (beslissing 14+16)
- Match-model (3 lagen: score/match/contract) — beslissing + FE gebouwd
- Bulk-acties fase 1 (eigenaar/pool/funnel/type/tag-verwijderen/notitie/archiveren)
- Recruiter-kleur (B-11/C-12)
- Sticky header + default sort op Toegevoegd (DataTable)
- Horizontaal scrollbare tabel + sticky naamkolom
- Endpoint-rename (C-17 + B-15): `/crm/*` → schone namen, `/sm/*` → `sm_`-prefix
- API-keys + scopes (B-4/C-5a)
- Settings-herstructurering (eigen menu's per domein + sub-tabs)
- Opportunties shell (C-28 klaar)
- Pakket-model FE stappen 1–6 (B-26 deels)
- Dashboard: klik past filter toe (B-24), instroom-chart (B-25)
- Klanten herbouwd naar candidate-blueprint (E4)
- WhatsApp Business + persoonlijk (FE gebouwd, wacht gateway)
- Koios AI chat + settings (B-2 deels)
- Documenten-upload (C-3)
- Functions lookup (C-14)
