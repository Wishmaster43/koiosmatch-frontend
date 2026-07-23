# Koios Match — Career Site (CAREER-1)

Standalone public career site: vacancy list + detail + apply. No auth, no cookies —
a fully separate Vite/React/TS app inside this repo, with its own build, entirely
independent of the admin app in `src/`.

## Why a separate app

Danny wanted a public URL that only shows vacancies and lets candidates apply,
without shipping (or exposing) any part of the admin bundle. This lives in
`careersite/` with its own `vite.config.ts` / `tsconfig.json`, reusing the repo's
root `node_modules` (React, react-dom, react-router-dom are already there) but
never importing from `src/`.

## Dev

```bash
npm run dev:career
```

Runs Vite against `careersite/vite.config.ts`. Visit e.g.
`http://localhost:5173/acme/vacatures` (replace `acme` with a real tenant slug).

## Build

```bash
npm run build:career
```

Builds to `dist-careersite/` (a sibling of the admin's `dist/`, never inside it).

## Tests

```bash
npm run test:career
```

## Configuration

Copy `careersite/.env.example` to `careersite/.env` and adjust:

- `VITE_CAREER_API_URL` — base of the public career API, **without** the trailing
  `/public/{tenant}` (the client appends that itself). Defaults to the local Herd
  dev host (`http://koiosmatch-api.test/api`).
- `VITE_CAREER_BASE` — Vite's `base` path for the built assets. Use `/` for a plain
  domain root, or a sub-path if the site is deployed under one.

## Routing

- `/` — tenant-less landing notice (this site is only ever linked with a tenant slug).
- `/:tenant/vacatures` — vacancy list (filters: city, min. hours; paginated).
- `/:tenant/vacatures/:ref` — vacancy detail + inline apply form.
- Anything else — a friendly 404.

## Hosting notes

- Intended per-tenant URL shape: `jobs.jaicob.ai/{tenant}/vacatures` (the `:tenant`
  route param carries the tenant slug — no separate build per tenant).
- Only **published** vacancies show up: the backend's `/public/{tenant}/vacancies`
  endpoint only returns vacancies with the career channel switched on for that
  tenant. There is no client-side filtering of unpublished vacancies — if a vacancy
  is missing here, check the tenant's career-channel toggle in Settings, not this app.
- The API is fully public/unauthenticated: no cookies, no bearer token, no CSRF —
  every request sets `credentials: 'omit'`. Never add auth here; this is a different
  trust boundary than the admin app.
- The apply form includes a hidden honeypot field (`website`, always empty for real
  visitors) and a mandatory AVG consent checkbox that gates the actual network
  request — see `src/components/ApplyForm.tsx`.
- **CAREER-SITE-ACTIVE.** `GET /public/{tenant}/site` always answers (even for a
  tenant that never opted in) and always carries an `active` flag; the DATA
  endpoints (vacancies/apply/feeds/sitemap) 404 while it is `false`. `theme.tsx`
  reads that flag and `TenantLayout` renders a calm, tenant-neutral "deze
  vacaturesite is niet actief" notice instead of the generic error state — see
  `src/strings.ts` `inactive` and the `'inactive'` branch in `useSiteTheme`/`TenantLayout`.
- **Filters + pagination are URL-persisted.** `VacancyListPage` reads/writes
  `?stad=&uren=&pagina=` via `useSearchParams` (see `src/pages/VacancyListPage.tsx`),
  so sharing, refreshing or navigating back reproduces the same filtered/paged view.
  Typing and paging use `replace` (never `push`), so the browser history isn't
  flooded with one entry per keystroke/page.

## Follow-ups (not built here)

- Multi-locale copy: `src/strings.ts` is a single NL module, structured so a real
  i18n layer (react-i18next, mirroring the admin app) can replace it without
  touching call sites — out of scope for this MVP.
- **Per-tenant sitemap wiring is not built here.** `public/robots.txt` is one static
  file, shared by every tenant hosted under this domain, allowing all crawlers but
  deliberately carrying no `Sitemap:` directive. The backend already serves a real
  per-tenant sitemap at `GET /api/public/{tenant}/sitemap.xml`
  (`CareerFeedController@sitemap`), but a single static file cannot enumerate every
  tenant's sitemap URL without already knowing every tenant slug at build time.
  Wiring this up for real needs either a per-tenant robots.txt generated at the
  hosting/reverse-proxy layer, or a small dynamic endpoint that lists active
  tenants — not faked here.
