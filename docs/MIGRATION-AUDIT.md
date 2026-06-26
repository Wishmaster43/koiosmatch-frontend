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
| 0 | Fundament: `tsconfig` (baseUrl weg) · `typecheck`-script · dit logboek · types-strategie | ✅ klaar | — |
| 1 | `lib/` + data-mappers (`mapCandidate`/`mapApplication`/…) | ☐ | — |
| 2 | `components/ui/` (gedeelde blueprint-props) | ☐ | — |
| 3+ | Per feature-map: candidates → applications → vacancies → customers → … | ☐ | — |

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
- [MEDIUM] [FE] **`initialsOf` gedupliceerd** — ±8 files (o.a. CustomersPage, AddApplicationModal,
  candidatesShared) — zelfde helper meermaals gekopieerd → centraliseren in één gedeelde util tijdens de pass.

### 🔵 LOW
- _(geen)_

---

## Gefixt tijdens de pass
- **Golf 0 — `setState-in-useMemo` (4× baseline, React-19 error):** `setPage(1)` ín de filter-`useMemo`
  van MatchesPage:72 · OpportunitiesPage:65 · TasksPage:133 (zelfde copy-paste-drift als de eerder
  gefixte ApplicationsPage) → verplaatst naar een `useEffect` op de filter-deps. + ongebruikte `user` in
  CustomersPage:29 verwijderd. **Baseline lint/typecheck nu groen** → migratie kan "groen per golf" draaien.

---

## Backend-coördinatie (uit de pass)
- _(nog geen — verwijst naar `worklist.md` C-items + MASTER-WORKLIST BE-tabel)_
