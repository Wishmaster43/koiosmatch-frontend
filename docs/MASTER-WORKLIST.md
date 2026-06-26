# Koios Match — MASTER WORKLIST (doe-dit-nu)

> **Afvinkbare board naast [`MASTER-PLAN.md`](./MASTER-PLAN.md)** (= het detail/de waarom).
> Dit bestand = **wie doet wat, wanneer.** Detail per bevinding blijft in `architect-Worklist.md`;
> backend-C-items in `worklist.md`. **Bijgewerkt:** 2026-06-25.
>
> **Status:** ☐ open · ◐ deels · ✅ klaar · 🔴 blocker · ⚠️ wacht-op-Danny · 🔒 wacht-op-backend.
> **Tracks:** [D] Danny-beslissing · [FE] Frontend · [BE] Backend. **P0–P5** = prioriteit uit MASTER-PLAN §4.
> **Werkregel elke taak:** Engelse code + 1 comment/blok · split > ~400 · alles via API · i18n × 5 · Self-Audit.

---

## 🎯 NU — deze sprint (in volgorde)

| ✓ | ID | Track | Taak | Done als |
|---|----|-------|------|----------|
| ✅ | N-1 | [FE] P0 | **Security-sweep** gedaan — PII-leak in dev-error-log gedicht; SafeHtml/secrets/links schoon | findings ≤ LOW ✅ |
| ☐ | N-2 | [FE+BE] P0 | **Auth → Sanctum httpOnly-cookie** (D1 besloten): backend stateful-domains+CORS+CSRF (BE-8), dán FE `VITE_COOKIE_AUTH`+withCredentials. **Niet flippen vóór BE klaar** | login via cookie; geen token in localStorage |
| ✅ | N-3 | [FE] P1 | **Mock-strip candidates** — `DUMMY_CANDIDATES` + mock-file weg (commit 4063113) | 0× DUMMY/USE_MOCKS ✅ |
| ✅ | N-4 | [FE] P1 | **Mock-strip applications** — `mocks.js` weg; `bucketOfPhase`→`applicationsShared.js`; lint-fix | 0× MOCK_* ✅ |
| ✅ | N-5 | [FE] P1 | **Mock-strip vacancies** — `USE_MOCKS` uit catch | 0× USE_MOCKS ✅ |
| ✅ | N-6 | [FE] P1 | **Workflow-mocks weg** — `MOCK_WORKFLOWS`/`MOCK_LOGS` → echte `/workflow-runs`; de-dup via `runFormat.jsx` | fallbacks weg ✅ |
| ✅ | N-7 | [FE] P0 | **npm audit** — dompurify 3.4.10→3.4.11; dev-toolchain (vitest@4 breaking) uitgesteld | geen prod-HIGH/CRIT ✅ |

> **NU-sprint klaar** (commit `4063113`). Volgende: **N-2 auth-migratie** (wacht op BE-8) · radius wiren
> (wacht op **D2**) · dan P2 (RF-splits) → P3 (editor-i18n). Eerst: **her-audit-ronde** (convergentie-loop).

---

## 👤 Danny — beslissingen (deblokkeren werk)

| ✓ | ID | Vraag | Aanrader | Blokkeert |
|---|----|-------|----------|-----------|
| ✅ | D1 | Auth-model | **BESLOTEN 2026-06-26: httpOnly-cookie (Sanctum SPA)** — Bearer-in-localStorage uitfaseren; API-keys blijven token | → N-2 + BE-8 |
| ✅ | D2 | Radius-anker | **BESLOTEN: beide, elk op eigen scherm** — kandidatenlijst vanaf **vestiging/plaats** (`?lat=&lng=`), vacature/match-scherm vanaf **vacature** (`?near_vacancy=`) | → FE-P5-7 + FE-P5-7b |
| ☐ | D3 | E-mail-UI-plek in Settings | eigen sub-tab | email-verhuizing (P5) |
| ☐ | D4 | TypeScript-migratie nu starten? | ja — `lib/`+`components/ui/` eerst | CS-5 (P4) |
| ☐ | D5 | Native planning-module nu of backlog | backlog (read-only SM nu) | planning (P5) |

> Bestaande open Danny-vragen (A-1…A-9) staan in `worklist.md §A` — niet hier dupliceren.

---

## 🖥️ Frontend — backlog per prioriteit

### P2 — Modulariteit afmaken
- ☐ **FE-P2-1** Split `ReportFilterSidebar` (469) · `MessagesTable` (423) · WorkflowCanvasEditor-restant (863) → elk < ~400.
- ☐ **FE-P2-2** Blueprint-conformiteit verifiëren: vacancies/customers/applications/matches/opportunities/tasks = zelfde shape als candidate (geen 2e MODULE_META, shared DataTable/InsightsRow/ActionMenu/bulkMutate).
- ☐ **FE-P2-3** AW-5/6: LinksTab alle 9 koppel-types config-gedreven · WorkflowsPage `StepPill` uit gedeelde registry. AW-9: date-veld → datepicker (DD-MM-YYYY).

### P3 — i18n compleet (geen Dutch islands)
- ☐ **FE-P3-1** Editor-i18n-pass: workflow-editor (~60 strings, 0×`t()`) + module-registry labels/categorieën + `CATEGORY_ORDER` → keys × 5 locales.
- ☐ **FE-P3-2** Project-brede i18n-grep op JSX-literals/Dutch islands → 0 findings.

### P4 — Kwaliteit & schaalbaarheid (groot, apart inplannen)
- ☐ **FE-P4-1** CS-6: inline `api.*` → feature-`api/`-laag (72 files).
- ☐ **FE-P4-2** CS-5: PropTypes → **TypeScript** op shared laag (start `lib/` + `components/ui/`). *(wacht D4)*
- ☐ **FE-P4-3** CS-9: tests op kritieke paden (bulk-mutate optimistic/reconcile, data-mappers, 4 UI-states, auth-gated UI).
- ☐ **FE-P4-4** a11y-pass WCAG 2.2 AA (focus-trap+restore drawers/modals, aria-labels, kleur≠enig-signaal, contrast ≥4.5:1).
- ☐ **FE-P4-5** Virtualiseer grote tabellen (kandidaten/shifts, 10k+ rijen).

### P5 — Features die het product nog mist (op klantwaarde)
- ☐ **FE-P5-1** Changelog-tab per entiteit (`/{entity}/{id}/activity`).
- ☐ **FE-P5-2** Afspraken/intake: `requires_appointment`-stage-flag + inconsistentie-vlag + `/reports/intakes` + intake-agenda. *(🔒 endpoints)*
- ☐ **FE-P5-3** CV-builder: download (tenant-logo) + template-builder in Settings.
- ☐ **FE-P5-4** Bulk-acties compleet (WhatsApp-broadcast · beschikbaarheid uitvragen · taak/bellijst · shortlist+CV-mail · pool add/remove · kandidaattype multi · status/funnel). *(🔒 C-15)*
- ☐ **FE-P5-5** Backoffice-koppeling (HelloFlex/SM): manueel/bulk/workflow, queue+rate-limit, GUID-mapping, koppelfout op kandidaat.
- ☐ **FE-P5-6** E-mail → Settings per context (verhuis `ProfileEmailConnect`, wire `/settings/email/oauth/{context}`). *(wacht D3 + 🔒 status-endpoint)*
- ☐ **FE-P5-7** Radius-filter op **CandidatesPage** (anker = **vestiging/plaats**, `?lat=&lng=&radius=`): branch-picker → server-coords (geen geocoding) + radius-slider (35 km) + `distance_km`-kolom (sorteerbaar). Vrije-tekst-plaats = later (geocode-endpoint). *(D2 besloten)*
- ☐ **FE-P5-7b** Radius op **vacature/match-scherm** (anker = **vacature**, `?near_vacancy={id}&radius=`): "wie woont dichtbij deze klus?" — geen geocoding. *(D2 besloten)*

---

## ⚙️ Backend — wat wij nodig hebben (🔒 hangt frontend op)

| ✓ | ID | Levering | Deblokkeert FE |
|---|----|----------|----------------|
| ☐ | BE-1 | **C-27** workflow-graaf: `step_order` → `position` + `connections[]`, stabiele step-id's | FE-P2-3, editor echte graaf |
| ☐ | BE-2 | `GET /settings/email/{context}/status` | FE-P5-6 |
| ☐ | BE-3 | Intake/afspraken-endpoints (`/reports/intakes`, appointments) | FE-P5-2 |
| ☐ | BE-4 | C-15 array-uitbreiding (pool/tag/type add/remove) | FE-P5-4, B-3 |
| ☐ | BE-5 | Dashboard-KPI **deltas** (subs zijn nu `null`) | KPI-subs SM-dashboard |
| ☐ | BE-6 | C-5b webhook-delivery (stap 2) | B-6 webhooks-UI |
| ☐ | BE-7 | Yesway **PDOK-backfill** samen draaien (AVG-go gegeven) | radius op echte data |
| ☐ | BE-8 | **Sanctum SPA-cookie** (D1): stateful-domains · CORS `credentials:true` · `/sanctum/csrf-cookie` · Secure+SameSite | N-2 auth-migratie |

> Volgorde-advies aan backend: **C-27 eerst** (deblokkeert de workflow-editor het meest).

---

## ✅ Recent klaar (niet opnieuw doen)
RF-splits: ProfilePage · PlanningPanel · ShiftsChartsBlock · OrdersTable · LocationsPage · **CandidatesPage 674→308** · **App.jsx 468→71** · **VacanciesPage 424→275**. · Mock-strip **shiftmanager** (6 pagina's + dashboard → live `sm_`). · i18n shiftmanager-pagina's × 5. · Tests **102 groen** (+41). · Geo (lat/lng+PDOK) gebouwd · audit-JSON-blocker opgelost · `/nationalities`.

---

### Definition of Done (elke taak)
§0 CLAUDE.md · modulair < cap · 1 Engelse comment/blok · i18n nl+en (+de/fr/es parity) · keyboard-toegankelijk ·
geen secrets/PII · loading/error/empty/success · relevante test · **Self-Audit-blok** (MASTER-PLAN §9).
