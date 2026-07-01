# Backend-prompt — 0% mock data (alles uit de API)

**Doel:** géén mock/dummy/fallback-data meer in de frontend. Elk scherm 100% gevoed
door echte, **tenant-scoped, geseede** API-data. De frontend mag dan `src/lib/mocks.ts`,
`src/pages/candidates/data/mocks.ts` en alle lokale fallback-constanten verwijderen.

> **Huidige stand (FE):** `USE_MOCKS` staat **standaard uit** (alleen dev + expliciete
> `VITE_USE_MOCKS=true`), en in productie geforceerd uit. De **kern-entiteiten draaien al
> op echte endpoints**: `/candidates`, `/candidates/stats`, `/vacancies`, `/vacancies/stats`,
> `/customers`. De mock die overblijft is **fallback-data waar nog geen endpoint is** (vooral
> de planning-module) + demo-seed zodat de Demo-tenant gevuld oogt.

---

## 1. Vacature-URL (blokkeert de vacature-links in de kandidaat-drawer)

De Werk-tab (sollicitaties) en de Matches-tab tonen een vacaturenaam die een **link**
wordt zodra de API een URL geeft. Nu is er geen URL en geen interne vacatures-route.

- [ ] `GET /vacancies` + detail: veld **`url`** per vacature (publieke apply/detail-URL).
- [ ] Sollicitaties genest onder de kandidaat: `applications[].vacancy.url`.
- [ ] Matches genest onder de kandidaat: `matches[].vacancy_url` (of `vacancy.url`).
- [ ] Beslis: linken we **extern** (vacature-URL) of komt er een **interne** `/vacancies/{id}`
      detailpagina? Als intern → laat het id-veld consistent zijn (`vacancy.id`).

---

## 2. Planning-module — nu volledig frontend-mock

`src/pages/candidates/data/mocks.ts` levert deze lokaal (moet weg):
`AGENDA_SHIFTS`, `DUMMY_SHIFTS_LIST`, `DUMMY_OPEN_SHIFTS`, `FAV_SEARCH_DATA`.
Gebruikt door: `PlanningOpenShifts`, `PlanningScheduling`, `AvailabilityCalendar`,
`useCandidatePlanning`, `useCandidateDrawerData`.

Nodig (tenant-scoped, geseed):
- [ ] **Beschikbaarheid** per kandidaat — `GET /candidates/{id}/availability`
      (dagen/blokken; voedt `AvailabilityCalendar`).
- [ ] **Open shifts / agenda** — `GET /shifts?open=1` (+ filters) en/of
      `GET /candidates/{id}/agenda` (voedt `PlanningOpenShifts` / `AGENDA_SHIFTS`).
- [ ] **Inplannen** — `POST /shifts/{id}/schedule` `{ candidate_id }` /
      `DELETE …` (voedt `PlanningScheduling`, `DUMMY_SHIFTS_LIST`).
- [ ] **Opgeslagen zoekopdrachten** — `GET/POST /candidates/saved-searches`
      (voedt `FAV_SEARCH_DATA`).

> Dit sluit aan op de eigen planning-module (Orders/Shifts/Scheduled + eigen pool)
> die nog gebouwd wordt; lever minimaal read-only + seed zodat de UI echt oogt.

---

## 3. Overige fallbacks om te vervangen (per domein)

Deze hooks/components hebben nog een mock/fallback-tak; lever endpoint + seed zodat
de fallback verwijderd kan worden:

- [ ] **Customers**: `useCustomersData`, `useCustomerDrawerData`, `CustomerChangelog`
      (changelog/activity-endpoint), `useReportCustomers`.
- [ ] **ShiftManager** (rapportage-spiegel, `sm_`-prefix): `useSmContacts`,
      `useSmLocations`, `useSmDepartments`, `ShiftmanagerDashboard` — echte `sm_*`-endpoints + seed.
- [ ] **Tasks**: `TasksPage` — `GET /tasks` (+ kandidaat-gelinkte tellingen).
- [ ] **Candidate changelog/activity**: `GET /candidates/{id}/activity` (drawer changelog).

---

## 4. Demo-seed (zodat de Demo-tenant niet leeg is)

Voor élk bovenstaand domein: realistische, tenant-scoped **seed** (met kleuren/`sort_order`
waar van toepassing). Zo kan de frontend `VITE_USE_MOCKS` volledig schrappen en tonen we
overal echte data — ook in demo's.

## Acceptatie
- [ ] `src/lib/mocks.ts` + `src/pages/candidates/data/mocks.ts` kunnen weg zonder lege schermen.
- [ ] Geen enkel scherm valt terug op een lokale constante; alles komt uit de API.
- [ ] Vacature-links "lichten op" (§1). Demo-tenant is overal gevuld (§4).
