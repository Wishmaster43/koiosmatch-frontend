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
| ☐ | N-1 | [FE] P0 | **Security-sweep**: grep `dangerouslySetInnerHTML` · tokens in localStorage · secrets/`VITE_*` · PII/IDs in URLs/logs/`console.log` · externe `<a>` zonder `rel` | audit Security ✅, findings ≤ LOW |
| ☐ | N-2 | [D] P0 | **D1 auth-drift** beslissen (Bearer vs httpOnly) → CLAUDE.md §7 bijwerken | doc = code |
| ☐ | N-3 | [FE] P1 | **Mock-strip candidates**: `useCandidatesData` DUMMY_CANDIDATES + `candidatesMock.js` weg | 0× DUMMY/USE_MOCKS; lege call → lege staat |
| ☐ | N-4 | [FE] P1 | **Mock-strip applications**: `data/mocks.js` (MOCK_APPLICATIONS/buildMockDetail/MOCK_REJECTION_REASONS) + Page/AddModal/RejectionBlock | 0× MOCK_*; mocks-file verwijderd |
| ☐ | N-5 | [FE] P1 | **Mock-strip vacancies**: USE_MOCKS in `useVacanciesData` catch | 0× USE_MOCKS |
| ☐ | N-6 | [FE] P1 | **Mock-restant**: WorkflowsPage `MOCK_WORKFLOWS` · editor `MOCK_LOGS` → `/workflows` + `/workflow-runs` | fallbacks weg |
| ☐ | N-7 | [FE] P0 | `npm audit` + pin kwetsbare deps | geen HIGH/CRITICAL |

> Na NU: radius wiren (wacht op **D2**), dan P2 (RF-splits) → P3 (editor-i18n).

---

## 👤 Danny — beslissingen (deblokkeren werk)

| ✓ | ID | Vraag | Aanrader | Blokkeert |
|---|----|-------|----------|-----------|
| ☐ | D1 | Auth: Bearer (huidig) vs httpOnly-cookie | Bearer + doc + XSS-harden | N-2, security-doc |
| ☐ | D2 | Radius-anker: vacature / plaats / recruiter-locatie | vacature `?near_vacancy=` | radius-filter (P1) |
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
- ☐ **FE-P5-7** Radius-filter wiren + `distance_km`-kolom op CandidatesPage. *(wacht D2)*

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

> Volgorde-advies aan backend: **C-27 eerst** (deblokkeert de workflow-editor het meest).

---

## ✅ Recent klaar (niet opnieuw doen)
RF-splits: ProfilePage · PlanningPanel · ShiftsChartsBlock · OrdersTable · LocationsPage · **CandidatesPage 674→308** · **App.jsx 468→71** · **VacanciesPage 424→275**. · Mock-strip **shiftmanager** (6 pagina's + dashboard → live `sm_`). · i18n shiftmanager-pagina's × 5. · Tests **102 groen** (+41). · Geo (lat/lng+PDOK) gebouwd · audit-JSON-blocker opgelost · `/nationalities`.

---

### Definition of Done (elke taak)
§0 CLAUDE.md · modulair < cap · 1 Engelse comment/blok · i18n nl+en (+de/fr/es parity) · keyboard-toegankelijk ·
geen secrets/PII · loading/error/empty/success · relevante test · **Self-Audit-blok** (MASTER-PLAN §9).
