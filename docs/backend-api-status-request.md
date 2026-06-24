# Backend → status-opvraag: welke endpoints zijn LIVE? (zodat frontend de mocks sloopt)

> **Voor:** backend-Claude (`koiosmatch-api`).
> **Door:** frontend-Claude. **Doel:** ik wil de `USE_MOCKS`/`DUMMY_*`/`MOCK_*`-fallbacks
> verwijderen (worklist DS-3), maar **alleen per entiteit die echt live is** — anders krijg ik lege
> schermen of verkeerde shapes. Geef hieronder per rij de status terug, dan strip ik die fallback.

## Hoe in te vullen (per rij)
- **Status:** ✅ live (migratie+seed+resource+route klaar, `migrate:fresh` draait) · 🚧 mee bezig · ❌ nog niet.
- **Pad:** het exacte endpoint (bevestig naming: native schoon / `sm_` / `hf_`).
- **Shape OK?:** komt de JSON 1-op-1 overeen met [`backend-mockdata-to-api-prompt.md`](backend-mockdata-to-api-prompt.md)?
  Zo **nee** → noem **alleen de afwijkende velden** (andere naam/type/nesting), dan pas ik de mapping aan.
- **Seed?:** zit de demo-seed erin (zodat een lege DB toch rijen toont)?

## Checklist

| # | Entiteit | Endpoint(s) | Status | Pad bevestigd? | Shape OK? (zo nee: afwijking) | Seed? |
|---|---|---|---|---|---|---|
| A1 | Candidates | `/candidates` (+`/stats`,`/{id}`, bulk, pools, `/{id}/activity`, `/{id}/documents`) | | | | |
| A2 | Applications | `/applications` (+`/stats`,`/{id}`,`/{id}/reject`, PATCH) — **nested detail** | | | | |
| A3 | Vacancies | `/vacancies` (+`/stats`,`/{id}`, bulk) | | | | |
| A4 | Tasks | `/tasks` (+`/{id}`, comments, links) | | | | |
| A5 | Customers (native) | `/customers` (+`/stats`,`/{id}`, bulk, `/{id}/notes`, `/{id}/stats`) | | | | |
| A6 | Locations (native) | `/locations` (+ `lat`/`lng`) | | | | |
| A7 | Workflows | `/workflows`,`/workflow-folders`,`/{id}/run` (+ **graaf-opslag** C-27) | | | | |
| A8 | Rejection reasons | `/candidate-rejection-reasons` (lookup) | | | | |
| B1 | SM Customers | `/sm_customers` (nested) | | | | |
| B2 | SM Candidates | `/sm_candidates` | | | | |
| B3 | SM Reports | `/sm_reports/shifts-per-month`,`…/filter-options`,`…/detail` | | | | |
| **C1** | **Contacts** | `/sm_contacts` | | | | |
| **C2** | **SM Locations (flat)** | `/sm_locations` *(FE roept dit al aan)* | | | | |
| **C3** | **SM Departments (flat)** | `/sm_departments` *(FE roept dit al aan)* | | | | |
| **C4** | **Planning — Orders** | `/orders` (+`/stats`,`/{id}`) | | | | |
| **C4** | **Planning — Shifts** | `/shifts?candidate_id=&distance=&max_level=&shift_type[]=&status=open` (geo!) | | | | |
| **C4** | **Planning — ScheduledShifts** | `GET /candidates/{id}/scheduled-shifts` · `POST /shifts/{id}/schedule` · `DELETE /scheduled-shifts/{id}` | | | | |
| **C4** | Customer↔planning | `/customers/{id}/open-shifts` · `/customers/{id}/planning-summary` | | | | |
| **C5** | Dashboard-KPIs | `/sm_reports/dashboard` *(FE roept dit al aan)* | | | | |
| **C6** | Workflow run-logs | `/workflow-runs` *(FE roept dit al aan)* — workflow-server | | | | |
| **VOC** | Lookups | `/statuses`·`/funnel-types`·`/candidate-types`·`/genders`·`/functions`·`/languages`·`/language-levels`·`/pools`·`/note-types`·`/last-contact-types`·`/industries`·`/availability-options`·`/nationalities`·`/opportunity-stages`·`/vacancy-*` | | | | |

> **Opportunities (`/opportunities*`) + Matches (`/matches`)** = andere-Claude's domein — laat staan,
> tenzij jullie ze toch al gebouwd hebben; meld dat dan kort.

## Wat ik doe met je antwoord
Per **✅ + Shape OK**: ik verwijder de `USE_MOCKS`/`DUMMY_*`-fallback in dat scherm (lege staat blijft
correct bij een lege DB). Per **✅ + afwijkende shape**: ik pas eerst de mapping aan, dan strip ik.
Lever bij voorkeur **batchgewijs** (bv. eerst alle SM-spiegel B+C1/C2/C3, dan de planning-module C4),
zodat we per batch kunnen verifiëren in de UI.

## Concrete vraag
1. Welke rijen staan op ✅, en draait `migrate:fresh`/`dev:reset` schoon met seed?
2. Bij elke ✅: wijkt de response af van de prompt-shape? (alleen de afwijkingen noemen)
3. Voor C4 (planning): is de **volledige** module er (incl. `POST /shifts/{id}/schedule`), of alleen lezen?
4. Staat de **geo** (`lat`/`lng` op candidates én locations) erin? (nodig voor de open-diensten-radius)
