# DECISIONS — keuzes, impact & SaaS-schaalbaarheid (levend)

> Alle bewuste keuzes (Danny + Claude) met hun systeemimpact, plus de doel-topologie en een eerlijke
> schaalbaarheids-assessment van **10 → 1.000.000 tenants**. Bijwerken bij elke architectuur-/contractkeuze.
> Peildatum 2026-06-29.

## 1. Keuzelog

| # | Keuze | Door | Rationale | Systeemimpact |
|---|---|---|---|---|
| K-1 | Productnaam **Koios Match / KoiosMatch** (nooit "KoiosConnect") | Danny | merk | naamgeving overal; geen functioneel effect |
| K-2 | **Auth = Sanctum httpOnly-cookieflow** (Bearer-in-localStorage uitfaseren) | Danny (D1) | XSS-exfiltratie van tokens uitsluiten (§7) | **N-2 flip**, gecoördineerde backend-deploy; `COOKIE_AUTH`-scaffold staat; tot dan blijft `auth_token`/`auth_user` in `localStorage` (= openstaand **P1-security**) |
| K-3 | **Workflow-engine op aparte server** (runs/logs/queues apart) | Danny | isolatie + schaal van zware async | FE praat via **configureerbare base-URL**, async/queue-aware; ontkoppelt UI van engine-load |
| K-4 | **3 pakketten (Core/Pro/Enterprise) + losse add-ons/connectors** | Danny | prijs/COGS-model + super-admin-facturatie | module-gating in FE (`AppsContext`/`hasModule`); per-tenant features = config, geen code |
| K-5 | **WhatsApp Web (persoonlijk) via onofficiële gateway**, QR onder Profiel | Danny | persoonlijk WA zonder Meta-Business | **eigen WhatsApp-privé-server** in topologie; raakt Meta-API → buiten dev:reset houden |
| K-6 | **Endpoint-naamgeving: source-prefix** (`sm_`/`hf_` extern, schoon native) | Danny | herkomst onmiskenbaar | datalaag-conventie; voorkomt naam-botsing native↔mirror |
| K-7 | ~~Status/funnel = 3 assen~~ **(herzien door K-18, 2026-06-29)** | Danny | datamodel-integriteit | zie K-18 |
| K-8 | **Soft-delete only (FE); hard-delete = backend-only** | Danny | AVG special-category health | FE archiveert (`bulk/archive`); restore/force = API-enforced |
| K-9 | **DB-migratieconventie**: nooit `add_/alter_`, vouw in `create_<table>`; toepassen via `migrate:fresh`/`dev:reset` | Danny | schone, herhaalbare schema-historie | backend-only; pre-release reset-model |
| K-10 | **Hele FE → TypeScript** (nieuw bestand altijd `.ts/.tsx`) | Danny | grootste schaalbaarheidshefboom | **afgerond** in FE-domein; permissieve interfaces met index-sig, geen `any` in datamodellen |
| K-11 | **C-29 custom_fields = geparkeerd**; bij bouw: vaste types (text/number/date/select/bool) + **harde validatie** | Danny+Claude | geen ongevalideerde blobs op gezondheidsdata | uitgesteld; kader vastgelegd |
| K-12 | **C-34 rapporten = cohort-trechter** via append-only `application_stage_transitions` (niet de encrypted audit-log) | Danny+Claude | eerlijke conversie; analytics ≠ compliance-store | FE rendert dual-view (`reached_count` trechter + `current_count` fallback); self-healing |
| K-13 | **C-35 dashboard_type op 7 rollen**; `/auth/me` roles `string[]→[{name,dashboard_type}]` | Danny+Claude | rol-gebaseerd startdashboard | **gecoördineerde contract-flip** (gedaan); FE leest objecten, default `readonly` (least-privilege) |
| K-14 | **dev:reset zonder externe sync** | Danny+Claude | lokale reset mag Meta/SM-API niet raken | dev blijft 100% lokaal/reproduceerbaar |
| K-15 | **Rapporten-hub = nieuwe top-level sectie** (sub-tabs Flow/Recruiters/Vacancies/Matches) | Danny | analytische hub (B-28) | nieuwe route `reports`; gedeelde fase-keymap over alle rapporten |
| K-16 | **Alles op `main`, geen feature-branches; 2 Claudes parallel** | Danny | snelheid + simpele historie | collision-protocol: `git status` vóór edit, alleen eigen files stagen |
| K-17 | **Kandidaat-feature = blueprint** voor alle entiteiten (Page/Insights/Table/BulkBar/Modal/Drawer) | Danny | consistentie + herbruik | nieuwe entiteit = dunne config, geen nieuwe vorm |
| K-18 | **Assen-model v2 (2026-06-29)**: oude "status" splitst in **Fase** (Lead/Kandidaat) + **Inzetbaarheid** (Beschikbaar/Geplaatst/Niet beschikbaar/Ziek/Verlof, availability erin gevouwen); **Geplaatst** vereist gekoppelde Match; **Blacklist = een status-waarde** (besloten 2026-06-30, geen aparte vlag/knop) met `requires_reason`; **"Kandidaat type" → "Contractvorm"** (alleen label); Funnel ongewijzigd (per sollicitatie) | Danny | "status" mengde kwalificatie + inzetbaarheid → twee schone single-question assen | herziet K-7; **BE: migraties/modellen/seeders/API's (C-10)**, **FE: LookupsContext/drawer-pickers/tabel-kolommen/KPIs/rename (C-39)**; CLAUDE.md §3B v2 + memory bijgewerkt |

## 2. Doel-topologie (productie-SaaS)

```
            ┌──────────────┐     ┌──────────────┐
  browser → │ FE-server    │ →   │ BE/API-server│ → DB (multi-tenant, connection-scoped)
            │ (Vite build, │     │ (Laravel,    │ → queue → ┌─────────────────┐
            │  CDN-static) │     │  Sanctum)    │           │ Workflow-server │ (engine/runs/logs)
            └──────────────┘     └──────┬───────┘           └─────────────────┘
                                        │
                          ┌─────────────┼───────────────┐
                          ▼             ▼               ▼
                 WhatsApp-privé-srv   HelloFlex      ShiftManager
                 (onofficiële GW)     (hf_, queue+   (sm_, mirror)
                                       rate-limit)
   Dev + Prod gescheiden · backup/restore + PITR op DB · object-storage voor docs/CV.
```

## 3. Schaalbaarheid 10 → 1.000.000 tenants (FE-perspectief)

| Dimensie | Nu | Bij 1M tenants | Actie |
|---|---|---|---|
| **Route code-splitting** | ✓ `React.lazy` per page (`appPages.tsx`) | houdt | behouden; nieuwe pages lazy |
| **Lijst-virtualisatie** | ✗ tabellen renderen alle rijen | **breekt** bij 10k+ rijen/tenant | **F-11**: virtualiseer kandidaten/shifts/tabellen (P1) |
| **Bundlegrootte** | ⚠️ `useCvSettings` 1.4MB · `index` 895kB · chunks >500kB | trager first paint at scale | lazy-load zware deps (CV/tiptap/recharts) verder opknippen (P2) |
| **Data-caching** | ◐ `@tanstack/react-query` aanwezig, niet overal benut | herhaalde fetches duur | react-query consequent + stale-times (P2) |
| **N+1 / over-fetch** | ⚠️ enkele drawers fetchen per-tab los | latency-stapeling | batch/prefetch per drawer; `stats`-endpoints i.p.v. client-aggregatie (P2) |
| **Tenant-isolatie (view)** | ✓ connection-scoped backend; FE toont alleen eigen tenant | houdt | nooit client-side tenant-filtering vertrouwen (§7) |
| **Auth** | ⚠️ Bearer in `localStorage` (K-2 nog niet geflipt) | XSS-risico schaalt mee | **K-2 flip** naar httpOnly-cookie (P1) |
| **Theming per tenant** | ✓ CSS-variabelen via `useTenantTheme` | schaalt gratis | nieuwe tenant = variabelen, 0 componentwijziging |
| **Workflow-load** | ✓ aparte server (K-3) | houdt | queue + rate-limit (HelloFlex bulk) bewaken |
| **i18n** | ⚠️ Dutch-islands (modules/registry, workflow-editor) | niet-NL tenants zien NL | **i18n-hardening** (P1, zie AUDIT) |
| **Type-veiligheid** | ✓ volledig TS | grootste hefboom — gedaan | nieuwe code `.ts/.tsx` |
| **Backups/restore** | backend/infra | PITR + per-tenant export | backend-domein; FE respecteert geanonimiseerde/erased state (§8) |

**Samengevat:** de fundering schaalt (code-splitting, TS, tenant-theming, aparte workflow-server), maar drie
dingen moeten vóór "veel data per tenant": **(1) lijst-virtualisatie**, **(2) auth-cookieflip**,
**(3) i18n-hardening**. Bundle/caching/N+1 zijn P2-optimalisaties.
