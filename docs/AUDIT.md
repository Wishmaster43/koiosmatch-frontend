# AUDIT — file-by-file doorlichting (3 lenzen, levend)

> Sweep van `src/` op 2026-06-29 door **Audit (A)** · **Refactor (R)** · **Architect (Arch)**. Bevindingen met
> `file:line`, severity (P0–P3) en worklist-ID; daaronder het **reviewed-clean register** zodat elk bestand
> verantwoord is. `settings/` + `Sidebar.jsx` + actieve `candidates/`-WIP = 2e-Claude → read-only geauditeerd,
> findings als **handoff** gemarkeerd (niet door FE-Claude te fixen).
>
> **Eén bron per feit:** dit bestand = de **bewijslast** (`file:line` + reviewed-clean register). De
> geprioriteerde **acties + actuele status** leven in `worklist.md §G` onder dezelfde IDs — hier niet herhaald.

## 2026-07-02 · Volledige audit (FE + BE) — consistentie · refactor · schaal · architectuur

> Diepe, evidence-based audit van beide repo's. **Kernoordeel: beide codebases zijn gezond** — findings zijn
> **verfijningen, geen fires**. Twee "enge" BE-findings bleken vals na verificatie (eager-loading is er wél —
> `::with` 54×, geen systemische N+1; `Location`'s "BelongsToTenant" is een comment). Samengevat ook in backend's
> canonieke `COORDINATION-LOG` (2026-07-02) voor het gezamenlijke overleg.

**FE — geverifieerd sterk:** blueprint (7 entiteiten Page/Table/Drawer) · code-splitting 35× `React.lazy` ·
i18n 20 ns × 5 locales + parity-test · 0 `console.log` · dangerous-HTML alleen in `SafeHtml` (DOMPurify).

| # | Sev | Finding (bewijs) | Advies |
|---|---|---|---|
| **FE-1** | 🔴 P1-sec | `auth_token` in `localStorage` — 7 files (5 lookup-contexts lezen 'm direct) → XSS-exfiltratabel | cookie-flip (CO3/D1) + token-read centraliseren |
| **FE-2** | 🟠 scale | `@tanstack/react-query` in deps maar ~onbenut (1 file vs **25 rauwe `useEffect`-fetch**) | migreer list/detail-fetches → react-query + stale-times |
| **FE-3** | 🟡 consist | 23 hardcoded status/stage-keys (applications/candidates/outreach/tasks) | bind op flags (`is_match`/`is_rejected`/`requires_match`, §0) |
| **FE-4** | 🟡 mod | 3 files > 400r: `Dashboard` 502 · `CandidateDrawer` 446 · `ApplicationsPage` 433 | splitsen (single-purpose) |
| **FE-5** | 🟡 scale | 3/11 DataTables zonder `scrollParentRef` (kandidaten = 10k-target) | virtualisatie aanzetten |

**BE — geverifieerd sterk:** geen god-files (0 >400r) · migratie-conventie 100% · geen `raw_data` · eager-loading
aanwezig · geen tenant-lek (36 `where('tenant_id')` = legitieme central-user-validaties) · 126 tests · 0 TODO.

| # | Sev | Finding | Advies |
|---|---|---|---|
| **BE-1** | 🟡 mod | `routes/api/tenant.php` = **1000r (op de cap)** | per-domein splitsen (AP-E5, nu Medium) |
| **BE-2** | 🟡 open | H2 status-provenance · H4 globale rate-limit · candidate/vacancy custom-fields-follow-ups (AP-E9) | afmaken |

**Cross-cutting:** **X-1 (🟠)** AP-P1 OpenAPI→FE-types nog niet gedaan (sterkste drift-preventie ontbreekt) ·
**X-2** stale FE-docs (`DATA-API.md` + oude AUDIT-secties) · **X-3** nog op gedeelde working tree (worktrees pending).

**Top-3 om met backend te bespreken (hoogste hefboom):** (1) **AP-P1 OpenAPI→FE-types** (drift = compile-error) ·
(2) **FE-2 react-query** (refetch-storms) · (3) **FE-1 auth cookie-flip** (enige open P1-security).

---

## Bevindingen (met worklist-ID) — historisch (2026-06-29)

| ID | Lens | Sev | Bestand(en) `:line` | Probleem (bewijslast) |
|---|---|---|---|---|
| **F-13** | A | **P1** | `context/AuthContext.tsx:68,161,209,243` (+ `LookupsContext`/`VacancyLookupsContext`/`TaskLookupsContext`/`AppsContext`/`useCustomerLookups` lezen `auth_token`) | `auth_token` + `auth_user` (PII) in `localStorage` = XSS-exfiltratable (§7) |
| **I18N-1** | A | **P1** | `src/modules/*.ts` (applicant_message, tasks, ai_agent, …) | module-**labels/categorieën** zijn Dutch literals; §5 eist `t('modules.*')` |
| **I18N-2** | A | **P1** ◐ | `components/layout/WorkflowCanvasEditor.tsx` (CATEGORY_ORDER, "Module kiezen", "Opslaan", "Laden…", "Actief/Inactief", …) + `workflow/ScheduleModal`/`fields` | workflow-editor = **Dutch-island**; editor-chrome + `fields`/`fieldControls` ✅ via `t()`, **ModulePicker/ConfigPanel + registry-labels nog open** |
| **I18N-3** | A | ✅ | 34× `pages/`+`components/` zonder `useTranslation` | **FE-domein geverifieerd clean** (2026-06-29): `MessagesDetailPage`/`RunsDetailPage`/`PlanningTab` = pure page-wrappers · `Timeline`/`SubEntityTab`/KpiCard/StatCard/StatusPill/Avatar-marks/SafeHtml = dumb, tekst via props (§3-patroon, correct). Residu = `settings/*` (2e-Claude) + workflow-registry (= I18N-1/2). |
| **CFG-1** | Arch | P2 | `candidates/drawer/ProfileTab.tsx:30` `NATIONALITIES` · `auth/profileParts.tsx:21` `LANGUAGES` · `shiftmanager/AddCustomerModal.tsx:23` `STATUSES` | vocabularies hardcoded i.p.v. tenant-lookup (§3A) + Dutch |
| **R-SPLIT** | R | ✅ | sweep: `WorkflowCanvasEditor.tsx` (907) · `reports/ReportFilterSidebar.tsx` (485) · `reports/MessagesTable.tsx` (430) · `workflow/fields.tsx` (403) | > ~400r — **opgelost: nul files >400 in de repo** (zie §G R-SPLIT) |
| **DUP-1** | R | ✅ | `shiftmanager/departmentParts.tsx:6` · `contactParts.tsx:6` · `locationParts.tsx:8` · `planning/AddShiftModal.tsx:68` | identieke `AVATAR_COLORS`/`COLORS`-array 4× — **opgelost: `lib/avatarColor`** |
| **MOCK-1** | Arch | **P1** | `candidates/data/mocks.ts` → Planning-tab | kandidaat-Planning draait op dummy (DATA-API §1) |
| **D-1..D-6** | Arch | P1–P2 | matrix-bewijs: `DATA-API.md` §1-2 | changelog alleen candidates · soft-delete-gaten · geen restore-UI · tasks `/stats`+activity ontbreken |
| **A11Y-1** | A | P2 | ~28× `fixed inset-0` modal/drawer (alleen `ChangelogPopover` heeft `role=dialog`) | geen focus-trap/`aria-modal`/focus-restore (§6) |
| **A11Y-2** | A | P2 | icon-only `<button>` repo-breed (34 `aria-label` / 359 buttons) | X-close/sort/chevron/trash zonder `aria-label` |
| **ERR-1** | A | P2 | 94× `.catch(() => {})` / `catch { /* noop */ }` | fouten ingeslikt — geen dev-log, geen user-facing error-state (= F-12) |
| **F-8** | R | P2 | 53× component met inline `api.*`+`useEffect` (`RunsTable`, SM-`*Table`'s, `AIManagementTabs`, `AgentForm`, `TenantSwitcher`, …) | datalaag in component i.p.v. hook (§3) |
| **DUP-2** | R | P3 | drawer-shell-className ×10 · table-shell ×7 · card-shell ×6 · error-banner ×6 | herhaalde class-strings + rauwe `text-red-600`/`bg-red-50`/`border-gray-100` i.p.v. tokens (§4) |
| ~~USE_MOCKS~~ | — | ✅ | `lib/mocks.ts:13` | **opgelost**: `USE_MOCKS` is DEV-gated (`import.meta.env.DEV && VITE_USE_MOCKS`) → shipt nooit in prod |

## Reviewed-clean register (gesweept, geen findings)

| Laag | Aantal | Oordeel |
|---|---|---|
| `lib/` (28) | api-client, formatters, i18n-setup, lookups-hooks, `mocks.ts`(flag+util), colorPresets, usePageSize, datetime, queryClient | **clean** — single-purpose utils; `isAbortError` herbruikt; geen secrets |
| `context/` (7) | Auth/Theme/Apps/Lookups/RightPanel/… | clean **m.u.v.** AuthContext localStorage (F-13) |
| `types/` (18) | permissieve interfaces + index-sig, geen `any` in datamodellen | **clean** — consistente migratie-typing |
| `components/ui` + `drawer` + `insights` + `charts` (gedeeld) | dumb/herbruikbaar (Avatar, StatusPill, DataTable, EntityHeader, InsightsRow, KpiCard, SafeHtml(sanitized)) | **clean** — geen API/logica; `dangerouslySetInnerHTML` alleen in `SafeHtml` mét sanitisatie + reden (§7 OK) |
| `modules/` (56) | registry + `makeEntityModule`-factory; één bron (`index.ts`) | **clean qua structuur**; labels = I18N-1 |
| `pages/reports` (FE-Claude, deze sessie) | Flow/Recruiters/Vacancies/Matches + hub + hooks | **clean** — hooks, 4 UI-states, i18n 5 locales, gedeelde keymap |
| `pages/shiftmanager` (FE-Claude) | reports/tables/drawers (deze sessie gemigreerd) | clean **m.u.v.** DUP-1 + `AddCustomerModal` STATUSES (CFG-1) |
| `pages/{applications,vacancies,matches,opportunities,tasks,customers,users,auth,dashboard,whatsapp,ai,planning}` | blueprint-features | **grotendeels clean**; punten: I18N-3 (enkele drawers), D-1..D-6 (data-gaps), MOCK-1 (planning) |
| `pages/candidates/**` + `pages/settings/**` + `components/layout/Sidebar.jsx` | **2e-Claude-domein** | **read-only geauditeerd** → findings als handoff (CFG-1 ProfileTab, MOCK-1 planning, en gemelde i18n in registry.jsx 66 labels / AppsContext) |
| `App/main/i18n` (shell) | providers/guards/entry | **clean** — 1 hardcoded "Laden…" in `App.tsx` (transient pre-auth loader) → I18N-3-bucket |

## Notities
- **Geen** `console.log`/`console.debug` in gecommitte code. **Geen** ongesanitiseerde dangerous HTML.
  **Geen** hard-delete-call in de FE. Dit zijn positieve bevestigingen, geen findings.
- ESLint: **0 errors**, ~589 warnings = **deep-relative-imports** (`../../`) — §11-conventie, repo-brede
  cleanup (P3, eigen item **F-12b**).
