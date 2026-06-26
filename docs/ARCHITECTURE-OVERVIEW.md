# Koios Match — Systeem- & Architectuuroverzicht

> **Eén document dat het hele systeem beschrijft:** de server-/infrastructuur-architectuur, hoe de
> frontend in elkaar zit, en **welke keuzes er gemaakt zijn (met waarom)**. Synthese van de volledige
> beslis-historie (alle Claude-chats), de governance-docs (`CLAUDE.md`, `ARCHITECTURE.md`,
> `MASTER-PLAN.md`) en de geheugenbestanden. **Bijgewerkt:** 2026-06-26.
>
> **Verhouding tot andere docs:** `ARCHITECTURE.md` = entiteiten/contracten/statussen (bron-van-waarheid
> voor de architect-review) · `MASTER-PLAN.md` = strategie/waarom · `MASTER-WORKLIST.md` = doe-dit-board ·
> **dit bestand = het systeembrede plaatje + het beslis-logboek.**

---

## 1. Het product in het kort

**Koios Match** (ook **KoiosMatch**) — een **multi-tenant SaaS** voor Nederlandse zorg-flexbemiddeling.
Primaire tenant: **Yesway Flex B.V.** De data is **special-category persoonsdata (gezondheid)** onder de
AVG/GDPR — dat is een **harde randvoorwaarde**, geen feature.

- **Multi-tenant:** één gebruiker logt **één keer** in en kan tussen tenants **switchen** (super-admin /
  multi-bureau). Tenant-context gaat via de `X-Tenant`-header; de **backend her-checkt** of de gebruiker
  die tenant mag gebruiken (alleen super-admin mag switchen).
- **Schaal-aanname:** ~50 tenants, veel gebruikers elk. *"Bouwen als een huis waar je 10 verdiepingen
  op kunt zetten."*
- **Naam:** altijd **Koios Match** — nooit "KoiosConnect/Koios Connect".

---

## 2. Server- & infrastructuur-architectuur

### 2.1 De 6-server-topologie (afdwingen)
| Server | Rol | Regel |
|---|---|---|
| **Backend API** (`api.koiosmatch.com`) | Laravel — alle business-logica, autorisatie, DB | Her-checkt élke autorisatie + tenant-scope |
| **Frontend** (`app.koiosmatch.com`) | React SPA (static `dist`) | Praat **alleen** met de backend-API |
| **Workflow-server** | Zware/async workflow-engine (runs/queues/logs) | FE **triggert/poll't**, blokkeert nooit; FE praat via de backend |
| **WhatsApp private server** | Baileys (onofficiële WA-gateway, persoonlijk WA) | FE praat **ALLEEN via de backend**, nooit direct |
| **Load balancer** | Verdeelt verkeer over meerdere app-servers | **Geen sticky state** → gedeelde sessie-store nodig (zie D1) |
| **Danny's dashboard** | Eigen monitoring/dashboard | Deelt componenten met de hoofd-app |

**Kernprincipe:** de frontend is een *view* op de backend. Hij **verzint nooit data**, berekent geen
server-eigen afgeleide waarden, en praat nooit direct met de workflow-/WhatsApp-servers.

### 2.2 Domeinen & omgevingen (besloten — D1)
- **Productie (klanten):** `app.koiosmatch.com` → API `api.koiosmatch.com`
- **Development:** `development.app.koiosmatch.com` → API `api.koiosmatch.com`
- Beide SPA-origins vallen onder het registrable domain **`koiosmatch.com`** → **first-party** → de
  auth-cookie werkt met `SameSite=Lax` (geen Safari-ITP-risico).
- **Lokaal** (vite op `localhost`) is niet same-site met koiosmatch.com → blijft op Bearer-auth.

### 2.3 Auth-architectuur (D1 — besloten 2026-06-26)
- **SPA-auth = Sanctum httpOnly-cookieflow** (de veilige standaard). Het token is onleesbaar voor JS →
  bij een XSS kan een aanvaller geen herbruikbaar token exfiltreren. CSRF wordt door Sanctum afgehandeld
  (CSRF-cookie + `SameSite`).
- **Bearer-token-in-localStorage** (huidig) wordt **uitgefaseerd**. De **API-keys-feature** (externe
  consumers) blijft terecht token-based.
- **Backend-infra is gebouwd** (commit `2ef65ff`, staff-only): `EnsureFrontendRequestsAreStateful` op de
  api-group, CORS `credentials:true` + `X-XSRF-TOKEN`, `/sanctum/csrf-cookie`. **Onderweg een MFA-bypass
  dichtgezet** (`Auth::attempt()` opent een web-sessie → met cookies aan zou dat de 2e factor omzeilen;
  nu: sessie pas ná geldige code + session-id-regen tegen fixation).
- **FE-kant is klaar** (`lib/api.ts`: `withCredentials`/`withXSRFToken`/`XSRF-TOKEN`/`X-XSRF-TOKEN`;
  `primeCsrf()` draait vóór de login in `AuthContext`). **Flag staat uit** (`VITE_COOKIE_AUTH`).
- **De flip = één atomaire deploy** (BE-host in `SANCTUM_STATEFUL_DOMAINS` + FE `VITE_COOKIE_AUTH=true`
  in hetzelfde window; één kant eerst = 419/401).
- **Sessie-store = Redis** (besloten): LB-veilig (meerdere app-servers → gedeeld + snel), **geen
  DB-migratie**. Lokaal `SESSION_DRIVER=file`. Redis dient later ook voor cache + queues.

**Runbook-env (productie, tak A — Lax):**
```
SANCTUM_STATEFUL_DOMAINS=app.koiosmatch.com,development.app.koiosmatch.com
SESSION_DRIVER=redis
SESSION_DOMAIN=.koiosmatch.com
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
CORS_ALLOWED_ORIGINS=https://app.koiosmatch.com,https://development.app.koiosmatch.com
# Frontend:
VITE_API_URL=https://api.koiosmatch.com/api
VITE_COOKIE_AUTH=true
```

### 2.4 Endpoint-naming (afdwingen)
- **Native Koios-resources = schoon/onprefixed:** `/candidates`, `/customers`, `/locations`,
  `/departments`, `/contacts`, `/kpis`, `/reports`, …
- **Externe spiegels dragen hun bronprefix** (origin onmiddellijk zichtbaar):
  **ShiftManager → `sm_`** (`/sm_customers`, `/sm_candidates`, `/sm_reports/…`) ·
  **HelloFlex → `hf_`** (`/hf_customers`, …). Nooit een native resource prefixen; nooit een externe
  spiegel een schone naam laten bezetten.

### 2.5 Backend-conventies (uit scope van deze repo, maar afgesproken)
- DB-migratie-conventie: **nooit** een `add_*/alter_*/change_*`-migratie — vouw elke schemawijziging in de
  bestaande `create_<table>`-migratie; toepassen via `migrate:fresh` / `dev:reset` (pre-release).
- Backend-laaggroottes (gedeelde standaard): controller ≤ ~150 (thin) · Service/Action ~200–300 (één
  publieke methode) · Model/Resource/Request ≤ ~200.

---

## 3. Frontend-architectuur

### 3.1 Stack
React 18 + **Vite** · **Tailwind** (design-tokens via CSS-vars) · `react-router-dom` · **axios** (één
geconfigureerde client) · **Recharts** · **lucide-react** · **react-i18next** (nl/en/de/fr/es) · fonts
Inter (UI) + JetBrains Mono (cijfers/IDs) · **Vitest + RTL** · ESLint + Prettier · **TypeScript**
(migratie loopt — zie §3.6).

### 3.2 Mapstructuur (huidig + doel)
```
src/
  app/ · pages/ (thin, route-niveau) · components/ (gedeelde dumb UI) · components/ui/ (primitives)
  hooks/ · context/ (Auth, RightPanel, Lookups, Apps, Theme, …) · lib/ (api-client, formatters, i18n)
  types/ (gedeelde TS-types: common, candidate, application, vacancy, customer, opportunity, task, api)
  i18n/locales/ (nl/en/de/fr/es) · modules/ (workflow-node-registry) · styles/ · assets/
  pages/<entity>/  <Entity>Page · <Entity>Table · <Entity>Drawer · drawer/ (één component per tab) ·
                   data/ (mapXxx.ts) · hooks/ (useXData/useXOptions/useXBulkActions)
```
Doel (langere termijn, CLAUDE.md §2): `features/<domain>/{components,hooks,api,utils,index.js}`. Een
feature raakt **nooit** de internals van een andere — alleen via de publieke surface.

### 3.3 Het entiteit-blueprint (de kandidaat-feature = referentie)
Elke entiteit (candidates, vacancies, customers, applications, matches, opportunities, tasks, …) krijgt
**dezelfde vorm uit dezelfde gedeelde onderdelen** — nooit een nieuwe vorm:
- **`<Entity>Page`** = thin container (wire't data via hooks).
- **`<Entity>Table`** declareert alleen **kolommen** → gedeelde `components/ui/DataTable` (sortering,
  selectie, sticky, loading/empty).
- **`<Entity>InsightsRow`** = config-gedreven (`donuts[]` + `kpis[]`), klik-om-te-filteren.
- **`<Entity>BulkBar`** = thin assembler → gedeelde `components/ui/ActionMenu` + één generieke optimistische
  `bulkMutate` (update → reconcile op server's `updated`/`skipped`); destructief = authorization-gated.
- **`Add<Entity>Modal`** + **`<Entity>Drawer`** (thin container: header-config + tab-lijst; één component
  per tab in `drawer/`).
- Vier UI-states **altijd** (loading/error/empty/success); lege/foutieve call → lege staat, **nooit
  verzonnen rijen**.

### 3.4 Datalaag
- **Eén axios-client** (`lib/api.ts`) met interceptors: hangt auth + `X-Tenant` aan, normaliseert errors,
  centrale 401-afhandeling, 429-backoff. `unwrapList()` normaliseert de **drie API-dialecten**
  (`{data,meta}` · bare object/array · `/reports`-paginatie).
- **Mappers** (`data/mapXxx.ts`) zijn de **enige plek** die een rauwe API-record naar de UI-shape vertaalt
  — getypt als `(raw: ApiX): X`, zodat **contract-drift bij compile-time bovendrijft**. Defensief
  (`??`-fallbacks), nooit een crash op een ontbrekend veld.
- API-calls horen in een feature-`api/`-laag (CS-6, in uitvoering), niet inline in componenten.
- **Niets hardcoded:** status/funnel/candidate-types/genders/functies/talen/pools/… komen uit
  **tenant-lookups** via Settings, gelezen via `useX()`/`LookupsContext` met seed-fallback.

### 3.5 Cross-cutting (UI)
- **Theming:** per-tenant via CSS-variabelen (`useTenantTheme`); componenten lezen tokens (`--color-*`,
  `--text*`), nooit hardcoded hex. Volledig light/dark.
- **i18n: all-or-nothing × 5 locales.** Geen hardcoded user-facing string, geen Dutch islands, geen label
  naast een `t()`-key, geen missende key. `Intl` (nl-NL) voor datums (DD-MM-YYYY)/getallen.
- **a11y (WCAG 2.2 AA):** semantische HTML, focus-trap+restore in drawers/modals, labels/aria, kleur nooit
  enig signaal, contrast ≥ 4.5:1.
- **Performance:** route-split (`React.lazy`), virtualisatie van grote tabellen (10k+ rijen), debounce,
  in-flight requests cancelen on unmount.
- **Security (client = vijandig):** geen secrets in client · geen `dangerouslySetInnerHTML` zonder
  DOMPurify (`components/ui/SafeHtml`) · geen PII/IDs/tokens in URLs/logs/analytics · externe links
  `rel="noopener noreferrer"` · autorisatie nooit client-side beslist.

### 3.6 TypeScript-migratie (lopend — D4)
Volledige repo → TS, **gradueel in groene golven** (elk: `typecheck + lint + test + build` groen → commit).
Regel: **elk nieuw bestand = `.ts`/`.tsx`**. Stand:
- **Golf 0:** fundament (`tsconfig` strict, `npm run typecheck`-gate, findings-logboek). ✅
- **Golf 1a:** dedup `initialsOf` (17 kopieën → één `lib/initials.ts`). ✅
- **Golf 1b:** alle 6 data-mappers + `src/types/<entity>.ts` (raw `ApiX` → UI-shape). ✅
- **Golf 2:** alle 24 `components/ui` → `.tsx` (typed props/refs/events). ✅
- **Golf 3+:** per feature-map (candidates → applications → …). ☐
Elke aangeraakte file krijgt in dezelfde pass: TS · architect/contract-check · audit
(security/i18n/a11y/4-states/file-size) · duplicate-opschoning · één Engelse comment per blok. Logboek:
`docs/MIGRATION-AUDIT.md`.

---

## 4. Modules, pakketten & facturatie
- **Modules:** ATS & CRM (kern) · AI Agents & Workflow · Planning (add-on) · Rapportage ShiftManager ·
  Rapportage HelloFlex. **Pakketten:** Core (ATS+CRM) · Pro (+ AI & Workflow) · Enterprise · **losse
  add-ons** (planning, SM/HF-rapportage, AI-planner) + **App-connectors** (alleen met AI & Workflow).
- De pakket-matrix stuurt **module-zichtbaarheid** (gating in de FE is cosmetisch; backend her-checkt).
- **Super Admin = alleen Danny:** modules per tenant inrichten + **verbruik per tenant** (AI-tokens,
  WhatsApp-nummers) voor facturatie — **nooit alle klanten tegelijk tonen**.
- **WhatsApp:** Business-module (officieel) **én** WhatsApp Web persoonlijk (Baileys, QR-koppeling onder
  Profiel) — beide via de backend.

---

## 5. Entiteiten & datamodel (kort — detail in `ARCHITECTURE.md`)
Alles is gelinkt: **Candidate · Opportunity · Vacancy · Application · Match (+match-score) · Task ·
Workflow · TalentPool · Customer → Location → Department → Contact** · (native, later) **Order → Shift →
ScheduledShift**. ShiftManager/HelloFlex = externe spiegels (read-only).

**Kandidaat = 3 assen + beschikbaarheid** (nooit samenvouwen):
- **Candidate type** = contractvorm, **multi-value** (on-call/freelance/payroll/…). Verandert zelden.
- **Status (lifecycle)** = single (Lead · Candidate · Matched · Inactive · Unplaceable). **Blacklist** =
  aparte flag; **Archived** = soft-delete (`deleted_at`), geen status. Gedreven door **workflow-automation**.
- **Funnel-stage** = single **per sollicitatie** (Applied · Invited/Intake · Proposed · Hired · Rejected).
  "Sollicitant" is afgeleid (≥1 live sollicitatie).
- **Beschikbaarheid** (Available/Sick/Leave) = aparte as.
Status ↔ funnel zijn gekoppeld **via automation**, niet via één veld. Status/beschikbaarheid-wijzigingen
zijn **gedateerd en beredeneerd** (effective_from + reason, in de audit-trail).

---

## 6. Beslis-logboek (de gemaakte keuzes, met waarom)

### Open beslissingen D1–D5
| # | Keuze | Besluit | Waarom |
|---|---|---|---|
| **D1** | Auth-model | **httpOnly-cookie (Sanctum SPA)**; domeinen app/development.app/api onder koiosmatch.com (Lax); **Redis** sessies | Gezondheidsdata + we renderen user-HTML → XSS-blast-radius minimaliseren; first-party = simpel/stabiel; LB-veilige sessie-store |
| **D2** | Radius-anker (geo) | **Beide, elk op eigen scherm**: kandidatenlijst vanaf **vestiging/plaats** (`?lat=&lng=`), vacature/match-scherm vanaf **vacature** (`?near_vacancy=`) | Picker-ankers hebben server-coords → geen geocoding; dekt beide use-cases natuurlijk |
| **D3** | E-mail-UI-plek | **Al gebouwd**: per-context sub-tabs in Settings (klanten/kandidaten/planning). Profiel-mailbox = ándere (persoonlijke) feature, blijft | Geen verhuizing/duplicatie; tenant-breed ≠ per-gebruiker |
| **D4** | TypeScript | **Nu, gradueel, shared-first** + "nieuw = TS" | Grootste schaalbaarheidshefboom; vangt API-drift in de mappers |
| **D5** | Native planning-module | **Backlog** (read-only SM nu) | Eerst klantportaal + kandidaat-app; native write-module later |

### Bredere product-/architectuurkeuzes (uit de chats)
- **Candidate-feature = blueprint** voor elke entiteit; nooit een nieuwe vorm verzinnen.
- **3-assen-kandidaatmodel** (zie §5) — de oude candidate-funnel `prospect/intake/pool/alumni` is
  **retired** (verwarde drie assen tot één).
- **Match = voortzetting van een sollicitatie → placement.** Twee paden: via funnel (Hired → Match) of
  direct match. Backoffice-koppeling (HelloFlex/SM): manueel/bulk/workflow, queue+rate-limit, GUID-mapping,
  koppelfout op de kandidaat tot opgelost.
- **Soft-delete only** voor kandidaten; check op actieve gekoppelde objecten vóór verwijderen; hard-delete
  alleen backend wanneer niets hangt. Respecteer gewiste/geanonimiseerde staat.
- **Appointment-gated funnel-stages** (`requires_appointment`-flag, nooit hardcoden welke stage de intake
  is) + intake-reporting (`/reports/intakes`) + intake-agenda.
- **Geo (lat/lng + PDOK-geocoding)** alleen op **native** candidates+customers (SM heeft eigen geo).
- **Workflow-modules** = registry in `src/modules/` uit één `makeEntityModule({...})`-factory; filter-VALUES
  uit tenant-lookups, filter-`field`-keys = backend-vocabulaire; editor persisteert een **graaf**
  (`position` + `connections[]`) met **stabiele step-id's** (backend C-27).
- **Endpoint-naming** (sm_/hf_) en **DB-migratie-conventie** zoals §2.4/§2.5.
- **Workflow & WhatsApp draaien op aparte servers** (async/queue-aware; FE alleen triggeren/pollen via
  backend).
- **Communicatie/werkwijze:** alles op **main** (geen feature-branches); volledige files in chat; kleine
  stappen + bevestigen; **uitleg vóór elke wijziging**; Engelse code/comments, communicatie in het
  Nederlands.

---

## 7. Status & roadmap (pointer)
Volledige stand + geprioriteerde acties: **`MASTER-WORKLIST.md`** (doe-dit-board) en **`MASTER-PLAN.md`**
(strategie). Kort:
- **Klaar:** alle RF-splits, 0% mock op entity-pagina's + shiftmanager, geo gebouwd, audit-blocker
  opgelost, D1-backend-infra (`2ef65ff`), TS-migratie t/m Golf 2.
- **Loopt:** TS-migratie Golf 3+ (feature-mappen), her-audit-convergentie-loop.
- **Wacht op deploy/ops:** D1-flip (atomair window + Redis) · radius-wiring (na geo-backfill) ·
  C-27 workflow-graaf · intake/afspraken-endpoints.
