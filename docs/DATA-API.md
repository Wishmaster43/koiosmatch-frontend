# DATA-API — mock-inventaris + API/CRUD-matrix (levend)

> Bron: statische sweep van `src/` (alle `api.*`-calls + mock-imports), 2026-06-29.
> Doel: zien wat nog **mock** is en welke resources **Read/Create/Update/Delete + soft/hard-delete +
> changelog** dekken — en waar de gaten zitten (FE vs backend). Werk dit bij bij elke datalaag-wijziging.

## 1. Mock-data-inventaris

| Bron | Wat is mock | Consument(en) | Gap / actie | Eigenaar |
|---|---|---|---|---|
| `src/pages/candidates/data/mocks.ts` | `AGENDA_SHIFTS` · `DUMMY_SHIFTS_LIST` · `DUMMY_OPEN_SHIFTS` · `FAV_SEARCH_DATA` | candidate **Planning**-tab: `AvailabilityCalendar` · `PlanningScheduling` · `PlanningOpenShifts` · `PlanningFavorites` | **Planning-module niet gewired** → tab toont dummy. Backend: planning-endpoints (shifts/agenda/open-shifts/favorites per kandidaat). FE: hooks erop. **P1.** | backend + 2e-Claude (candidates/) |
| `src/lib/mocks.ts` → `USE_MOCKS` | feature-flag (geen data) | `components/reports/CustomersTable.tsx` | Verifiëren dat `USE_MOCKS` **nooit** `true` is in prod-build; anders shipt SM-customers mock. **P2.** | FE-Claude |
| `src/lib/mocks.ts` → `isAbortError` | util (geen data) | ~14 pages/hooks | OK — gewoon een abort-guard, geen mock-data. | — |
| Hardcoded vocabularies (geen API) | `ProfileTab` `NATIONALITIES` · `profileParts` `LANGUAGES` · `AddCustomerModal` `STATUSES` | candidate-profiel · profiel · SM add-customer | Moeten **tenant-lookups** zijn (§3A "niets hardcoded") + i18n. **P2.** | backend (lookup) + FE |

**Niet-mock maar let op:** `src/pages/candidates/drawer/KoiosAiBlock.tsx`, `ChangelogTab.tsx` e.a. kwamen in de
mock-grep door het woord "mock"/Math.random in commentaar/fallback — geen echte mock-data (geverifieerd).

## 2. API-matrix per resource (zoals de FE 'm aanroept)

Legenda: ✓ = aanwezig · ✗ = ontbreekt · soft = `POST /{res}/bulk/archive` (= `deleted_at`) · changelog = `/{res}/{id}/activity`.

### Native resources
| Resource | Read | Create | Update | Soft-delete | stats | changelog | notes/tags | sub-resources |
|---|---|---|---|---|---|---|---|---|
| **candidates** | list · {id} · stats · activity | ✓ | PATCH | ✓ bulk/archive | ✓ | ✓ `/activity` | bulk notes · tags/remove | documents (C/U/D) · pools (C/D) |
| **customers** | list · {id} · stats · {id}/stats · open-shifts · planning-summary | ✓ | PATCH | ✓ bulk/archive | ✓ | ✗ | notes (C + bulk) · tags (bulk +/−) | — |
| **vacancies** | list · {id} · stats | ✓ | PATCH | ✓ bulk/archive | ✓ | ✗ | bulk notes · tags/remove | — |
| **applications** | list · {id} · stats | ✓ | PATCH | ✗ | ✓ | ✗ | — | `{id}/reject` (POST) |
| **opportunities** | list · {id} · stats | ✓ | PATCH | ✗ | ✓ | ✗ | — | — |
| **tasks** | list · {id} | ✓ | PATCH | ✗ | ✗ | ✗ (tab bestaat, geen endpoint) | comments (C) · links (C/D) | — |
| **matches** | list | ✗ | ✗ | ✗ | ✗ | ✗ | — | read-only **by design** (§3B) |
| **users** | list | ✓ | PATCH | ✗ | — | — | roles (PUT) | — |
| **pools** | list | — | — | — | — | — | candidates (C/D) | — |

### Lookups (FE leest read-only; CRUD zit in `settings/` = 2e-Claude)
`genders · functions · industries · languages · language-levels · availability-options · document-types ·
note-types · last-contact-types · candidate-rejection-reasons · opportunity-stages` — alle **GET-only** in de FE.

### Externe spiegels (read-only, source-prefix §10)
`sm_candidates · sm_customers · sm_contacts · sm_departments · sm_locations · sm_reports/* · shifts` — **GET-only**.

### Overig
- **auth**: login · logout · me · me/avatar (POST/DELETE) · mfa (setup/confirm/verify/disable).
- **profile**: email (connect/disconnect/smtp) · whatsapp-web (CRUD-ish: list/create/{id}/connect/disconnect/delete).
- **ai**: agents · prompts · faqs · knowledge (volledige CRUD) · koios (chat/settings) · agents/{id}/chat.
- **workflows**: CRUD · folders (CRUD) · runs (GET) · `{id}/execute` · `{id}/run` · `test-module`.
- **whatsapp**: activity · escalations · messages · stats (GET).
- **reports**: flow · recruiters · vacancies · matches (GET) · dashboard.
- **webhooks**: POST. **settings**: GET/POST + candidate-lookups · customer-lookups · rejection · apps.

## 3. Cross-cutting gaps (→ worklist + backend-handoff)

| # | Gap | Impact | Eigenaar |
|---|---|---|---|
| D-1 | **Changelog alleen op candidates** | §3A wil changelog als herbruikbaar blok over álle entiteiten; customers/vacancies/applications/tasks/opportunities missen `/activity`. | backend (endpoint) + FE (tab) |
| D-2 | **Soft-delete (archive) alleen candidates/customers/vacancies** | tasks/opportunities/applications hebben geen archiveer-/deletepad → kunnen niet (soft) verwijderd worden vanuit de UI. | backend + FE (BulkBar) |
| D-3 | **Geen 'gearchiveerd bekijken + herstellen'-UI** | hard-delete/restore zijn backend-only (correct, §8) maar er is geen UI om gearchiveerde records te zien/herstellen. | FE + backend |
| D-4 | **tasks: geen `/stats`** | Taken-KPI-rij kan niet server-wide tellen (anders dan andere entiteiten). | backend + FE |
| D-5 | **tasks: activity-tab zonder endpoint** | `TaskDrawer` heeft `'activity'`-tab maar geen `/tasks/{id}/activity` → leeg/mock. | backend + FE |
| D-6 | **Hardcoded vocabularies** (nationaliteiten/talen/klantstatussen) | moeten tenant-lookups zijn (configureerbaar + i18n). | backend (lookup) + FE |

> **Geen** hard-delete- of force-delete-call in de FE gevonden — conform §8 (hard delete = backend-only).
> Normalisatie-artefacten in de sweep (`/candidates/{id}/{id}/{id}`) = template-literals met geneste
> sub-resources (`/candidates/${id}/${sub}/${subId}`), geen echte triple-id-routes.
