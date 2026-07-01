# DECISIONS — keuzes, impact & SaaS-schaalbaarheid (levend)

> Alle bewuste keuzes (Danny + Claude) met hun systeemimpact, plus de doel-topologie en een eerlijke
> schaalbaarheids-assessment van **10 → 1.000.000 tenants**. Bijwerken bij elke architectuur-/contractkeuze.
> Peildatum **2026-07-01** (was 2026-06-29 — K-19..K-31 toegevoegd).
>
> ⚠️ **Bekende drift (open):** `ARCHITECTURE.md §2/§3` beschrijft nog het **v1-status-model**
> (`lead·candidate·matched·inactive·unplaceable` + blacklist als aparte vlag + availability als losse as).
> Dat is door **K-18** vervangen door het **v2-assen-model**. `ARCHITECTURE.md` moet nog gelijkgetrokken
> worden (zie §4).

## 1. Keuzelog

| # | Keuze | Door | Rationale | Systeemimpact |
|---|---|---|---|---|
| K-1 | Productnaam **Koios Match / KoiosMatch** (nooit "KoiosConnect") | Danny | merk | naamgeving overal; geen functioneel effect |
| K-2 | **Auth = Sanctum httpOnly-cookieflow** (Bearer-in-localStorage uitfaseren) | Danny (D1) | XSS-exfiltratie van tokens uitsluiten (§7) | **N-2 flip**, gecoördineerde backend-deploy; `COOKIE_AUTH`-scaffold staat; tot dan blijft `auth_token`/`auth_user` in `localStorage` (= openstaand **P1-security**). **Domeinen besloten** (scenario 1 = first-party, `SameSite=Lax`): FE `app.koiosmatch.com` + `development.app.koiosmatch.com`, API `api.koiosmatch.com`, `SESSION_DOMAIN=.koiosmatch.com` → geen Safari-ITP-risico, hybride-fallback niet nodig. **Session-store = Redis** (multi-server/LB). Lokale dev blijft Bearer |
| K-3 | **Workflow-engine op aparte server** (runs/logs/queues apart) | Danny | isolatie + schaal van zware async | FE praat via **configureerbare base-URL**, async/queue-aware; ontkoppelt UI van engine-load |
| K-4 | **3 pakketten (Core/Pro/Enterprise) + losse add-ons/connectors** | Danny | prijs/COGS-model + super-admin-facturatie | module-gating in FE (`AppsContext`/`hasModule`); per-tenant features = config, geen code |
| K-5 | **WhatsApp Web (persoonlijk) via onofficiële gateway**, QR onder Profiel | Danny | persoonlijk WA zonder Meta-Business | **eigen WhatsApp-privé-server** in topologie; raakt Meta-API → buiten dev:reset houden |
| K-6 | **Endpoint-naamgeving: source-prefix** (`sm_`/`hf_` extern, schoon native) | Danny | herkomst onmiskenbaar | datalaag-conventie; voorkomt naam-botsing native↔mirror |
| K-7 | ~~Status/funnel = 3 assen~~ **(herzien door K-18, 2026-06-29)** | Danny | datamodel-integriteit | zie K-18 |
| K-8 | **Soft-delete only (FE); hard-delete = backend-only** | Danny | AVG special-category health | FE archiveert (`bulk/archive`); restore/force = API-enforced |
| K-9 | **DB-migratieconventie**: nooit `add_/alter_`, vouw in `create_<table>`; toepassen via `migrate:fresh`/`dev:reset` | Danny | schone, herhaalbare schema-historie | backend-only; pre-release reset-model |
| K-10 | **Hele FE → TypeScript** (nieuw bestand altijd `.ts/.tsx`) | Danny | grootste schaalbaarheidshefboom | **afgerond** in FE-domein; permissieve interfaces met index-sig, geen `any` in datamodellen |
| K-11 | ~~**C-29 custom_fields = geparkeerd**~~ **(ontparkeerd door K-27, 2026-06-29)**; bij bouw: vaste types (text/number/date/select/bool/textarea) + **harde validatie** | Danny+Claude | geen ongevalideerde blobs op gezondheidsdata | kader → uitgewerkt plan, zie K-27 |
| K-12 | **C-34 rapporten = cohort-trechter** via append-only `application_stage_transitions` (niet de encrypted audit-log) | Danny+Claude | eerlijke conversie; analytics ≠ compliance-store | FE rendert dual-view (`reached_count` trechter + `current_count` fallback); self-healing |
| K-13 | **C-35 dashboard_type op 7 rollen**; `/auth/me` roles `string[]→[{name,dashboard_type}]` | Danny+Claude | rol-gebaseerd startdashboard | **gecoördineerde contract-flip** (gedaan); FE leest objecten, default `readonly` (least-privilege) |
| K-14 | **dev:reset zonder externe sync** | Danny+Claude | lokale reset mag Meta/SM-API niet raken | dev blijft 100% lokaal/reproduceerbaar |
| K-15 | **Rapporten-hub = nieuwe top-level sectie** (sub-tabs Flow/Recruiters/Vacancies/Matches) | Danny | analytische hub (B-28) | nieuwe route `reports`; gedeelde fase-keymap over alle rapporten |
| K-16 | **Alles op `main`, geen feature-branches; 2 Claudes parallel** | Danny | snelheid + simpele historie | collision-protocol: `git status` vóór edit, alleen eigen files stagen |
| K-17 | **Kandidaat-feature = blueprint** voor alle entiteiten (Page/Insights/Table/BulkBar/Modal/Drawer) | Danny | consistentie + herbruik | nieuwe entiteit = dunne config, geen nieuwe vorm |
| K-18 | **Assen-model v2 (2026-06-29)**: oude "status" splitst in **Fase** (Lead/Kandidaat) + **Inzetbaarheid** (Beschikbaar/Geplaatst/Niet beschikbaar/Ziek/Verlof, availability erin gevouwen); **Geplaatst** vereist gekoppelde Match; **Blacklist = een status-waarde** (besloten 2026-06-30, geen aparte vlag/knop) met `requires_reason`; **"Kandidaat type" → "Contractvorm"** (alleen label); Funnel ongewijzigd (per sollicitatie) | Danny | "status" mengde kwalificatie + inzetbaarheid → twee schone single-question assen | herziet K-7; **BE: migraties/modellen/seeders/API's (C-10, Golf ② af 2026-07-01)**, **FE: LookupsContext/drawer-pickers/tabel-kolommen/KPIs/rename (C-39)**; CLAUDE.md §3B v2 + memory bijgewerkt; **⚠️ ARCHITECTURE.md §2/§3 nog v1** |
| K-19 | **Geo + planning gefaseerd (2026-06-25)**: geo (`lat/lng` + PDOK-geocoding) alleen op **native** candidates+customers (SM heeft al geo); planning gefaseerd — read-only SM-mirror nu, native write + geo later | Danny+Claude | verrijking zonder externe koppeling te forceren | FE geocode op native adressen; SM blijft mirror |
| K-20 | **Matches-planbord = sleepbaar** (drag = fase wijzigen) — bewuste **uitzondering op "match = read-only" (§3B)** | Danny (2026-07-01) | operationeel plannen op het bord | spiegelt `TasksBoard`; MatchesTab op de kandidaat blíjft read-only |
| K-21 | **WhatsApp-privé = aparte outbox-entiteit**; WhatsApp-pagina op **intentie** gesplitst (bedienen/analyseren/instellen); berichttype-classificatie + prioriteit + rate-limit per nummer | Danny (2026-07-01) | privé-WA schaalbaar + AVG-arm (body encrypted) | `whatsapp_outbox` (niet raw `jobs`); drain op (priority, scheduled_at) per nummer; B-28/C-43 |
| K-22 | **Subtaken op taken = JA** | Danny (2026-07-01) | checklist binnen een taak | `tasks.parent_id`/light subtasks-tabel; drawer-checklist; C-18a |
| K-23 | **Bellijsten/Outreach-campagnes = eigen entiteit** (géén taak overladen); gegenereerd uit talentpool/selectie; per-kandidaat status + kanaal | Danny (2026-07-01) | campagne ≠ losse taak | `outreach_campaigns` + `outreach_targets`; nieuwe blueprint-feature; C-18b |
| K-24 | **Kans = zorg-detacherings-opportunity** (verfijnt A-2): waarde (€) **én** uren los; looptijd = start+eind-datum; dienst/sector + overeenkomsttype = tenant-lookups; org-koppeling klant→locatie→afdeling→contact; taken op de Kans | Danny (2026-07-01) | echte detacherings-deal i.p.v. kale €-deal | velden in `create_opportunities`; nieuwe lookups; C-42 — **A-2 hierdoor de facto beantwoord (nog formeel afvinken)** |
| K-25 | **Native Planning-module = eigen entiteiten, 0% mock** (orders/shifts/assignments/uren) met Settings-lookups | Danny | eigen planning i.p.v. alleen SM-mirror | `planning_*`-tabellen, guards (spots/availability/blacklist), afgeleide velden; C-44 (🔴 backend) |
| K-26 | **Vacature-detail gelijkgetrokken met kandidaat** + **`match_profiles` als eigen entiteit** (Settings-default + per-vacature override) | Danny+Claude (2026-07-01) | één blueprint-shape; herbruikbaar matchprofiel | `contract_types` (= `candidate_types` multi), gestructureerd adres, functie/industrie via lookups, `description` = rich HTML; C-26.1/26.2 |
| K-27 | **C-29 custom fields ontparkeerd (2026-06-29)**: `label_i18n` (hoofdlabel + optionele vertalingen), **merge = modal met slimme voorinvulling** (géén auto-merge), custom-veld **opt-in als tabel-kolom** (`show_in_table`), verplichte velden **per fase** | Danny | configureerbaar zonder ongevalideerde blobs | herziet K-11; getypeerde defs + server-validatie per type; B-21/C-29 |
| K-28 | **Workflow-run-operations (AVG + schaal)**: run-**metadata** lang bewaren, run-**I/O-payload** kort → purgen (tenant-instelbaar); **max runtime** (per-stap + workflow-wall-clock, pakket-configureerbaar); stuck/timeout-monitoring | Danny+Claude (2026-07-01) | gezondheidsdata in run-I/O + engine-bescherming | draait op de aparte workflow-server (K-3); C-27-workflow |
| K-29 | **Docs-consolidatie (2026-06-27)**: `worklist.md` = enige levende worklist · `ARCHITECTURE.md` = model+contract · `DECISIONS.md` = keuzelog; MASTER-PLAN/architect-Worklist/backend-prompts **git-rm'd** | Danny+Claude | één bron per feit, geen parallelle worklists | niet herstellen; nieuwe findings → worklist §F/§G |
| K-30 | **CV-template van browser-`localStorage` → tenant-`/settings`** (per-tenant i.p.v. per-device) | Claude+Danny | AVG/§7: geen per-device config op gezondheidscontext | `candidate_cv_template` in `/settings`-blob; C-37c |
| K-31 | **Multi-Claude = worktree-per-lane (COORD-1, 2026-07-01)** | Danny+Claude | index-contaminatie tussen parallelle lanes uitsluiten | eigen worktree+branch+index per lane; serieel mergen; `docs/COORDINATION.md` |

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

## 4. Consistentie-status (docs onderling) — bijwerken bij elke doc-wijziging

Bron-rangorde: **CLAUDE.md** (regels) > **DECISIONS.md** (keuzelog) > **ARCHITECTURE.md** (model+contract) >
**worklist.md** (open taken). Bij tegenspraak wint de hogere. Bekende drift op peildatum:

| # | Drift | Waar | Correct volgens | Actie |
|---|---|---|---|---|
| DR-1 | **v1-status-model** (`lead·candidate·matched·inactive·unplaceable` + blacklist-vlag + availability als losse as) | `ARCHITECTURE.md §2/§3` | K-18 / CLAUDE.md §3B v2 | `ARCHITECTURE.md §2/§3` herschrijven naar v2 (Fase + Inzetbaarheid, blacklist=status-waarde, availability gevouwen) |
| DR-2 | "Lees eerst … **K-1..K-17**" | `BACKEND-HANDOFF.md` | nu K-1..K-31 | teller bijwerken |
| DR-3 | **A-2 open** ("Kans = deal of vacature?") terwijl **C-42/K-24** het detacherings-model al bouwt | `worklist.md §A` | K-24 | A-2 formeel afvinken met de K-24-lezing |
| DR-4 | **A-1 open** (6-tabs drawer-plan) terwijl de drawer-herstructurering (2026-06-26, §D) al een andere tabset heeft geland | `worklist.md §A/§B-A1` | geland ontwerp | A-1 herbevestigen of als achterhaald sluiten |
| DR-5 | `C-1`-blok **dubbel** (identiek) | `worklist.md §C` (2×) | — | één ontdubbelen |

**Openstaande beslissingen (Danny)** — canoniek in `worklist.md §A`; hier alleen de kop zodat het keuzelog compleet leest:
A-1 drawer-redesign akkoord? (zie DR-4) · **A-2 Kans-definitie** (de facto K-24, afvinken) · A-4 WA-gateway-hosting (Hetzner vs strikt NL) ·
A-5 terminologie "vacancy" vs "vacature" · A-6 adres-weergave locaties · A-7 Taken-module verplicht voor auto-taken ·
A-8 "weer-beschikbaar"-actie in workflow of settings · A-9 default-kanalen afwijzing/benadering (e-mail/WA-Business/WA-privé).

## 5. CLAUDE.md harden-kandidaten (pas inbakken ná 0 audit-findings — memory `project-audit-convergence-loop`)

Ongeschreven standaarden die nu alleen in docs/memory leven en bij de laatste harden-stap in CLAUDE.md moeten:

- **Data-caching-regel (§9/§10).** `@tanstack/react-query` zit in de repo maar wordt onderbenut (DECISIONS §3). Regel:
  server-state via react-query met stale-times; geen losse `useEffect`-fetch waar caching hoort — sluit aan op F-8.
- **Nieuwe entiteiten in de blueprint-tekst (§2/§3A).** Native **Planning** (orders/shifts/assignments/uren, K-25),
  **Outreach/bellijsten** (K-23), **Appointments** (§3B, C-22) en **`match_profiles`** (K-26) staan nu alleen in
  losse §3B-stukken → opnemen in de folder-lijst (§2) en de entiteiten-blueprintlijst (§3A).
- **Multi-Claude-coördinatie (§14).** Worktree-per-lane (K-31 / COORD-1) staat alleen in `docs/COORDINATION.md`
  + memory → één regel in het werkafspraken-blok.
