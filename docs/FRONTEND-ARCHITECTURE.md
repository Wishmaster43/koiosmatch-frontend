# Koios Match — Frontend Architecture (reference)

> The architecture reference for the **frontend repo** (`koiosmatch-frontend`). Every claim below is
> verified against real code with `file:line` evidence (see §6, the architect verdict). One fact per
> claim. **Build status is stated separately from decisions** — a decision being made does not mean it is
> shipped.
>
> **Does not duplicate the API contract.** Entity shapes, relationships and endpoints live in
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) (contract, source of truth). System-wide topology + the full
> decision log live in [`ARCHITECTURE-OVERVIEW.md`](./ARCHITECTURE-OVERVIEW.md) and the backend repo's
> `docs/SYSTEM-ARCHITECTURE.md` / `docs/DEPLOY-D1-SANCTUM-SPA.md`. This doc cross-links to them (§5).
>
> **Updated:** 2026-06-26.

---

## 1. Hosting & deploy

- The frontend ships as a **static React build** (`vite build` → `dist/`), served from a CDN / object
  store behind the load balancer. It talks **only** to the backend API (`VITE_API_URL`).
- **Origins:** `app.koiosmatch.com` (production) + `development.app.koiosmatch.com` (dev). Both are
  **first-party** under the registrable domain `koiosmatch.com`, so the D1 auth cookie works with
  `SameSite=Lax`. **Local dev** (`localhost`) is not same-site with koiosmatch.com → stays on Bearer.
- **D1 cookie-flip, the FE role:** the FE is already cookie-ready; the flip is flipping one env flag
  (`VITE_COOKIE_AUTH=true`) **in the same atomic deploy window** as the backend adding the host to
  `SANCTUM_STATEFUL_DOMAINS`. One side first = 419/401. **Build status:** flag is **OFF** today
  (Bearer in production); the cookie path is implemented but dormant.

## 2. Frontend architecture (how it is built)

### 2.1 Stack
- **React 18 + TypeScript + Vite.** Tailwind (design tokens via CSS vars). `react-router-dom`. Charts via
  Recharts; icons via lucide-react. Tests: Vitest + React Testing Library. Lint: ESLint (flat config) +
  typescript-eslint.

### 2.2 The API client (single source)
- One configured axios instance in `lib/api.ts`. Interceptors attach auth + the `X-Tenant` header,
  normalise errors, handle 401 centrally and back off on 429. `unwrapList()` normalises the three API
  response dialects so call sites never re-guess the shape.
- **Cookie-auth wiring (D1):** `withCredentials` / `withXSRFToken` are bound to the `COOKIE_AUTH` flag,
  with `xsrfCookieName: 'XSRF-TOKEN'` and `xsrfHeaderName: 'X-XSRF-TOKEN'`. `primeCsrf()` GETs
  `/sanctum/csrf-cookie` before a state-changing auth call. In cookie mode **no Bearer header is attached**
  (the localStorage Bearer path is dormant). The flag + CSRF URL live in `lib/authMode.ts`.

### 2.3 Auth & gating
- `AuthContext` applies the `/auth/me` (or login) response: it stores `user` + `accessible_pages`, and on
  login runs `primeCsrf()` **before** the `/auth/login` POST.
- **UI gating is two-layer and cosmetic** (`lib/access.js`; the backend enforces real authorization on
  every endpoint): (1) **tenant/package** — accessible pages are the union of the tenant's effective
  modules (`tenantModules` → `MODULE_TO_PAGES`), with a legacy `PACKAGE_PAGES` / backend `accessible_pages`
  fallback; (2) **role/user** — `page.*` permissions act as a whitelist when present. Super-admins bypass
  all gates. SM/HF pages additionally require the paid `sm`/`hf` module.

### 2.4 State & data fetching
- **Local/UI state:** React state + Context (`AuthContext`, `RightPanelContext`, `LookupsContext`,
  `AppsContext`, `ThemeContext`, …). No Redux.
- **Server state:** two patterns — (a) **React Query** (`QueryClientProvider` in `App.jsx`, hooks in
  `lib/queries.js`) for shared lookups; (b) per-feature hooks (`useXData` / `useXOptions` /
  `useXBulkActions`) that call the axios client for list/detail/stats and lift state into the page
  container for optimistic bulk/drawer updates.
- **Mappers** (`pages/<entity>/data/mapXxx.ts`) are the single place that turns a raw API record into the
  UI shape, typed `(raw: ApiX): X` so contract drift surfaces at compile time. Defensive `??` fallbacks;
  never crash on a missing field. Nothing hardcoded — vocabularies come from tenant lookups via `useX()`.

### 2.5 Component structure (the blueprint)
- The candidate feature is the reference shape every entity mirrors: `<Entity>Page` (thin container) +
  `<Entity>Table` (columns → shared `components/ui/DataTable`) + `<Entity>InsightsRow` (config-driven) +
  `<Entity>BulkBar` (→ shared `ActionMenu` + one generic optimistic `bulkMutate`) + `Add<Entity>Modal` +
  `<Entity>Drawer` (thin: header config + tab list; one component per tab in `drawer/`).
- **Size discipline (CLAUDE.md §3):** component ≤ ~250 lines, hooks/utils separate (≤ ~150); split past
  ~400; 1000 is the hard cap. Logic lives in hooks, not JSX. All four UI states (loading/error/empty/
  success) are handled; an empty/failed call renders empty, never fabricated rows.

### 2.6 Cross-cutting
- **Routing:** route-level code splitting via `React.lazy` in `components/layout/appPages.jsx`.
- **Error boundaries:** a global `ErrorBoundary` (`components/ui/ErrorBoundary.tsx`) wraps the app in
  `App.jsx`; local boundaries wrap heavy widgets. The raw error is dev-only (never shown to users — §8).
- **i18n:** `react-i18next`, locales glob-loaded in `i18n/index.js` (`./locales/*/*.json`, eager), 18
  namespaces × **5 locales** (nl/en/de/fr/es), default `nl`, `fallbackLng: 'nl'`. `Intl` (nl-NL) for
  dates/numbers. All-or-nothing per area: no hardcoded user-facing strings, no Dutch islands.
- **Theming:** per-tenant via CSS variables; components read `--color-*` / `--text*` tokens, never
  hardcoded hex; full light/dark.
- **Security (client = hostile):** no secrets in the client; `dangerouslySetInnerHTML` only via DOMPurify
  (`components/ui/SafeHtml.tsx`); no PII/IDs/tokens in URLs/logs; external links get `rel="noopener
  noreferrer"`; authorization is never decided client-side.

### 2.7 TypeScript migration (build status)
Gradual full-repo migration in green waves (each: `typecheck + lint + test + build` green → commit). Rule:
**every new file is `.ts`/`.tsx`**. **Done:** Golf 0 (foundation: strict `tsconfig`, `npm run typecheck`
gate), 1a (dedup `initialsOf` → `lib/initials.ts`), 1b (all 6 data mappers + `src/types/<entity>.ts`),
2 (all 24 `components/ui`). **In progress:** Golf 3+ (feature folders). Log: `docs/MIGRATION-AUDIT.md`.

## 3. Architecture choices + why (frontend-facing)

| # | Choice | Decision | Why |
|---|---|---|---|
| D1 | SPA auth | httpOnly-cookie (Sanctum SPA); FE flips `VITE_COOKIE_AUTH` in the atomic window; Bearer stays for API-keys | Health data + we render user HTML → minimise XSS blast radius; first-party domains = `SameSite=Lax`, no ITP risk |
| — | One axios client | All requests go through `lib/api.ts` (auth, tenant, errors, 401, 429) | One place for auth/tenant/error policy; no fetch scattered across components |
| — | Mappers as the typed boundary | `(raw: ApiX): X` per entity | Catches backend contract drift at compile time (the recurring bug class) |
| — | Nothing hardcoded | Vocabularies from tenant lookups via `useX()` + seed fallback | Tenant-configurable; one source per label; no literal option lists |
| — | Component conventions | ≤ ~250 lines, logic in hooks, four UI states, shared blueprint | Single-purpose, predictable, reusable across entities |
| D4 | TypeScript | Gradual, shared-first, "new = TS", green per wave | Biggest scalability lever; no risky big-bang |
| — | i18n × 5 locales | All-or-nothing, `Intl` nl-NL | Multi-tenant, multi-language by default; no Dutch islands |

## 4. Feature / contract decisions the FE consumes
The FE consumes the backend C-series contract (shapes live in [`ARCHITECTURE.md`](./ARCHITECTURE.md); open
items in `worklist.md`). Frontend-relevant highlights:
- **Lookups** (status/funnel/candidate-types/genders/functions/languages/pools/…) via Settings endpoints,
  read through `useX()` / `LookupsContext`.
- **Server-wide stats** per entity (`/candidates/stats`, `/applications/stats`, …) — KPIs are server
  totals, not page-derived.
- **Geo / radius (D2):** `GET /candidates?lat=&lng=&radius=` or `?near_vacancy={id}&radius=`, rows carry
  `distance_km`; native candidates+customers only. FE wiring pending geo backfill.
- **Workflow graph (C-27):** steps persist `position` + `connections[]` with stable step ids; the editor
  saves the real graph once the backend rework lands (today a localStorage stopgap).
- **B-series FE paths:** email-per-context (built as Settings sub-tabs), bulk actions via `ActionMenu` +
  `bulkMutate`, candidate drawer redesign, WhatsApp Web (personal, under Profile). Full state in
  `MASTER-WORKLIST.md`.

## 5. Cross-links
- **Contract / entities:** [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- **System topology + decision log:** [`docs/ARCHITECTURE-OVERVIEW.md`](./ARCHITECTURE-OVERVIEW.md)
- **Strategy / board:** [`docs/MASTER-PLAN.md`](./MASTER-PLAN.md) · [`docs/MASTER-WORKLIST.md`](./MASTER-WORKLIST.md)
- **Backend repo (`koiosmatch-api`):** `docs/SYSTEM-ARCHITECTURE.md` (system/choices) · `docs/DEPLOY-D1-SANCTUM-SPA.md` (auth-flip runbook)

---

## 6. Architect verdict

**Verdict: COHERENT.** No BLOCKER/CRITICAL. Every claim above is backed by real frontend code. Evidence:

| Claim (§) | Evidence (`file:line`) |
|---|---|
| Static build talks only to `VITE_API_URL` (1, 2.2) | `src/lib/api.ts:24` (`baseURL: import.meta.env.VITE_API_URL`) |
| Cookie wiring bound to the flag (2.2) | `src/lib/api.ts:28-31` (`withCredentials`/`withXSRFToken`/`xsrfCookieName`/`xsrfHeaderName`) |
| CSRF priming before auth writes (2.2, 2.3) | `src/lib/api.ts:43-46` (`primeCsrf`) · `src/context/AuthContext.jsx:167` (`await primeCsrf()` before `/auth/login`) |
| No Bearer header in cookie mode (2.2) | `src/lib/api.ts:60` (`if (!COOKIE_AUTH && token) … Bearer`) |
| Flag + CSRF URL location (2.2) | `src/lib/authMode.ts:16` (`COOKIE_AUTH`) · `:24-25` (`CSRF_COOKIE_URL`) |
| `X-Tenant` attached per request (2.2) | `src/lib/api.ts:61` (`config.headers['X-Tenant'] = tenant`) |
| accessible_pages from /auth/me (2.3) | `src/context/AuthContext.jsx:38,42` |
| Two-layer cosmetic gating; super-admin bypass (2.3) | `src/lib/access.js:12` (cosmetic) · `:158` (`canAccessPage`) · `:162` (super-admin) · `:165-166` (module gate) · `:176-181` (`page.*` whitelist) |
| React Query configured + used (2.4) | `src/App.jsx` (`QueryClientProvider`) · `src/lib/queries.js` (`useQuery`) |
| Route-level lazy splitting (2.6) | `src/components/layout/appPages.jsx:9-18` (`lazy(() => import(...))`) |
| Global error boundary, dev-only detail (2.6) | `src/App.jsx` (wraps app) · `src/components/ui/ErrorBoundary.tsx` (`import.meta.env.DEV` gate) |
| i18n: glob locales, 5 langs, fallback nl (2.6) | `src/i18n/index.js:15` (glob) · `:30-31` (`lng`/`fallbackLng`) · `:41` (`LOCALE_BY_LANG` nl/en/de/fr/es) |
| DOMPurify-only dangerous HTML (2.6) | `src/components/ui/SafeHtml.tsx` (`DOMPurify.sanitize`) |
| Mappers typed `(raw: ApiX): X` (2.4) | `src/pages/candidates/data/mapCandidate.ts` (+ application/vacancy/customer/opportunity/task) · `src/types/*.ts` |
| TS migration status (2.7) | `docs/MIGRATION-AUDIT.md` (golf table) · `git ls-files '*.tsx'` (24 components/ui) |

**LOW notes (no action):** this doc is a snapshot — build status (e.g. `VITE_COOKIE_AUTH` OFF, Golf 3
pending) is stated separately from decisions, so it does not over-claim. The API contract is referenced,
not duplicated.
