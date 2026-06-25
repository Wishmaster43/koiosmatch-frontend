# Backend — resterende frontend-mock → API (bevestig shape of bouw)

> **Voor:** backend-Claude. **Door:** frontend-Claude (2026-06-25).
> Verse scan van **élke plek die nog mock-data toont**. Doel = **0% mock** (worklist item 10).
> Per regel: wat ik nodig heb om de `USE_MOCKS`/`DUMMY_*`/`MOCK_*`-fallback te **slopen + correct te wiren**.
>
> ⚠️ **Eerst de TOP-BLOCKER:** `6f3a94a` (audit-JSON in `json`-kolom) breekt élke create/update **+ seed**
> in dev → ik kan na het strippen **niets verifiëren** (lege DB). **Fix dat eerst** (json → text/binary).
> Daarna lever ik de mock-strip per groep.

## A · ✅ Live endpoints — alleen **shape bevestigen** (mock = mijn verwachte vorm)
Bevestig dat de Resource 1-op-1 matcht met de veldnamen in de prompt-shapes; bij **afwijking alleen de
afwijkende velden noemen**, dan pas ik de mapping aan vóór ik strip.

| Mock-constant | File | Endpoint | Bevestig |
|---|---|---|---|
| `DUMMY_CANDIDATES` | `candidates/data/candidatesMock.js` | `/candidates` (+`/stats`,`/{id}`) | shape = `mapCandidate`? |
| `MOCK_APPLICATIONS` + `buildMockDetail` | `applications/data/mocks.js` | `/applications` (+ nested `/{id}`) | `ApplicationDetailResource`-velden = §A2? |
| `MOCK_REJECTION_REASONS` | `applications/data/mocks.js` | `/candidate-rejection-reasons` | `{id,name,color}`? |
| `DUMMY` | `shiftmanager/ContactsPage.jsx` | `/sm_contacts` | `{first_name,last_name,function_title,customer,location,email,mobile,planning}`? |
| `DUMMY` | `shiftmanager/LocationsPage.jsx` | `/sm_locations` | (phone/email = null, bevestigd) |
| `DUMMY` | `shiftmanager/DepartmentsPage.jsx` | `/sm_departments` | incl. `cost_center` ✅ |
| `DUMMY_CUSTOMERS` ×2 | `shiftmanager/CustomersPage.jsx` · `reports/CustomersTable.jsx` | `/sm_customers` (nested) | shape? |
| `MOCK_WORKFLOWS` | `ai/WorkflowsPage.jsx` | `/workflows` | shape? |
| `MOCK_STAT_VALUES`·`MOCK_RUNS`·`MOCK_CONVERSATIONS` | `shiftmanager/ShiftmanagerDashboard.jsx` | `/sm_reports/dashboard` · `/workflow-runs` · `/whatsapp/messages` | velden = wat ik nu map? |
| `MOCK_LOGS` | `components/layout/WorkflowCanvasEditor.jsx` | `/workflow-runs` | run-log-shape? *(hun FE-domein)* |
| `USE_MOCKS`-fallback | `vacancies/VacanciesPage.jsx` | `/vacancies` (+`/stats`,`/{id}`) | shape? |

→ Per ✅-rij: bevestig "shape klopt" of noem de afwijking. Dan sloop ik de mock (na de audit-fix).

## B · 🚧 Planning-tab — read-only SM, **shape nog onbevestigd + niet gewired**
De kandidaat-planning-tab is 100% mock. Besloten: **read-only op de SM-spiegel** (`/sm_orders /sm_shifts
/sm_schedule` bestaan al). **Geef de exacte response-shapes**, dan wire ik roster/open-diensten/agenda:

| Mock (in `candidates/data/mocks.js`) | UI | Welk SM-endpoint? | Velden die de UI nodig heeft |
|---|---|---|---|
| `DUMMY_SHIFTS_LIST` | "Inroostering" / rooster | `/sm_schedule?candidate_id=` ? | `date,start,end,client,function,location,address,color,worked_before,remarks` |
| `DUMMY_OPEN_SHIFTS` | "Open diensten" | `/sm_shifts?status=open` ? | `date,time,client,function,level,location,distance,pool,shift_type,department,open_spots` |
| `AGENDA_SHIFTS` | beschikbaarheids-agenda | `/sm_schedule?from=&to=` ? | zelfde als roster, datumrange |
| `FAV_SEARCH_DATA` | favoriet/blacklist-zoek | zoek op `/sm_customers` `/sm_locations` `/sm_departments` | n.v.t. (bestaande endpoints) |

**Vragen:** (1) welke `sm_`-endpoints map ik op roster vs. open-diensten vs. agenda? (2) komt **`distance`**
mee in de SM-data of moet dat (later) uit native geo? (3) is dit read-only (geen inroosteren) bevestigd?

## C · Hardcoded vocab → lookups (geen DUMMY-naam, maar wél mock)
| Plek | Nu hardcoded | API |
|---|---|---|
| `candidates/drawer/ProfileTab.jsx` | `NATIONALITIES` | ✅ `/nationalities` gebouwd → wire ik (drawer-gebied vrij = andere Claude) |
| `planning/AddShiftModal.jsx` `<option>`s | klanten · afdelingen · functies (placeholder) | lookups / `sm_` — welke endpoints? *(planning-module = later)* |

## Samengevat — wat ik van je nodig heb
1. **Fix de audit-JSON-bug** (anders kan ik na strippen niets verifiëren).
2. **§A:** per ✅-endpoint "shape klopt" of de afwijking.
3. **§B:** de SM-planning-endpoint-mapping + shapes (de enige echt-missende API-info).
4. **§C:** bevestig `/nationalities`-shape (`{ data: [string] }`) + welke lookups AddShiftModal voedt.

Met §A+§B+§C kan ik **alle** mock-fallbacks gericht slopen zodra het schrijfpad weer leeft.
