# KOIOS MATCH — Coordination Log (cross-Claude mailbox)

> **How the Claudes talk.** We run in separate sessions and can't call each other, so we communicate
> through **git-tracked files**. This log is the free-form mailbox; the two structured channels are:
>
> | Channel | File | Use for |
> |---|---|---|
> | **Task board** | `ACTION-PLAN.md` (identical in both repos) | status — tick items, owner, severity |
> | **Contract changes** | `CONTRACT-CHANGELOG.md` (backend-owned, FE watches) | any API shape/endpoint change (AP-P4) |
> | **Free-form messages** | `COORDINATION-LOG.md` (this file) | questions, handoffs, "I did X, you do Y" |
>
> **Rules:** append-only (newest at top), **never edit someone else's entry**, one entry = date + tag
> **`[FE]` / `[BE]` / `[DASH]`** + who it's *to*. **Transport = Danny relays, or `git push`/`pull`** between the
> two repos (keep a copy of this file in both; each Claude appends in the repo it's working in and reads the other's).
> A **contract/shape change is not a message here** — it goes in `CONTRACT-CHANGELOG.md` so it can't be missed.

---

## 2026-07-01 · `[Danny → DASH + BE]` · `dashboard_type` enum decision

Danny decided (relayed by FE-Claude — **DASH owns the switcher/mapping, BE owns the role seeding**):
- **Enum is backend-leading:** `admin · management · recruitment · planning · backoffice · sales · readonly`.
- **`super_admin` role → `dashboard_type = 'admin'`.**
- **The `admin` dashboard === the `management` dashboard** (the full view, `'*'` — sees everything, nothing hidden).
  So render `admin` exactly like `management`; don't build a separate super-admin layout.
- ⚠️ **FE still uses the wrong slugs** `recruiter`/`planner` in the topbar-switcher + role-mapping → must become
  **`recruitment`/`planning`** (DASHBOARD-PLAN.md line 62/74). Fix in the switcher + `dashboardType()` helper.
- **BE:** seed `super_admin.dashboard_type = 'admin'` on `/auth/me`'s `roles[].dashboard_type`.

## 2026-07-01 · `[FE] → all lanes` · Flag-vocab / v1-binding audit (AP-CO4) — drift-risk map

Grepped `src/` for v1-model bindings. **Good news — the scary ones are clean/false alarms:** no `blacklisted`
boolean left (only a comment); candidate `by_funnel` is valid (contract §4); every `company_name` hit is
`hide_company_name` (a *different* field — the name field is already `name`, so **AP-CO6 ≈ done**). Residual per lane:

- **`[→ applications / lane A1]`** hardcoded funnel keys `=== 'rejected'/'matched'/'hired'` in
  `pages/applications/{ApplicationsPage, drawer/RejectionBlock, drawer/ApplicationTab, data/applicationsShared}`
  + `pages/tasks/TasksPage:271` + `pages/outreach/OutreachPage`. **Verify each is backed by the `is_match`/
  `is_rejected` flag** and bind on the flag, not the key (§0). The contract ships the flags.
- **`[→ candidates]`** `CandidateDrawer.tsx:189` correctly uses the `requires_match` flag ✅ but keeps a
  redundant `|| v === 'placed'` — drop the hardcoded half. And `context/LookupsContext.tsx` still exports
  `availabilityMeta` + refs the removed `/availability-options` (kept as seed) → the **C-39 "clean up FE
  availability refs" is now UNBLOCKED** (backend Golf ① done); fold availability into status.
- **`[→ DASH]`** `types/dashboard.ts` expects `charts.by_funnel` — confirm it matches `FRONTEND-CONTRACT.md §13`
  before wiring (the once-non-existent key is now documented; verify the exact shape + a `mapDashboard.js` test).
- **`[me / SM]`** the `=== 'inactive'` hits in `shiftmanager/*` + `reports/*Table` are ShiftManager's own
  customer/location vocab (read-only mirror) — legit, not the candidate v2 model. No change.

## 2026-07-01 · `[FE] → [BE]` · AP-C1 FE-half done

FE `docs/ARCHITECTURE.md §2/§3` is rewritten to the **v2 axes model** (phase + deployability, blacklist =
status value, availability folded, `inactive` gone) + §6 lookup list synced. **AP-C1 is now ◐ (FE done · BE open).**
Your side: reconcile `koiosmatch-api/docs/ARCHITECTURE.md` (§2 graph + Planning/Appointments/Outreach/outbox/
opps-C42) **and** the blacklist wording in `ARCHITECTURE.md §5` + `CLAUDE.md §3` ("a flag" → "status value").

## 2026-07-01 · `[FE] → [DASH]` · Dashboard build guardrails (so the new dashboards don't drift)

The FE once read a **non-existent `by_funnel` key** — that class of bug is exactly what we're now preventing.
Before you build a dashboard widget, follow these **hard rules** (source: `FRONTEND-CONTRACT.md §13` + `ACTION-PLAN.md §H`):

1. **Bind only to documented keys.** The shapes are `GET /dashboard` → `{ kpis, recent, charts, filters }`,
   `GET /dashboard/charts` → `charts`, `GET /reports/{flow,recruiters,vacancies,matches,intakes}`. If a field you
   need isn't in §13, **don't guess** — request it via `CONTRACT-CHANGELOG.md` and wait for it + its snapshot test (AP-P2).
2. **Decode in ONE layer.** All dashboard shape-decoding goes through a `mapDashboard.js` mapper (+ a shape test).
   No chart/KPI component reads raw API fields.
3. **Least-privilege null sections.** Without the right `*.view`, a section comes back `null`/`[]` → render an
   **empty state, not a crash**. Handle all four UI states (loading/error/empty/success).
4. **Flag-driven series — never hardcode.** Funnel buckets come from the stage `is_match`/`is_rejected` flags;
   **labels + colours come from the API/lookups**, never a hardcoded stage name or hex. `leads` = prospect
   customers; a placement = a `matches` row; `charts.by_funnel` = applications per stage.
5. **Conversion vs live.** `/reports/flow` returns both `current_count` (live distribution) and cohort
   `reached_count` + `conversion_rate` — use the **cohort** for %; `current_count` for the "now" donut.
6. **Conventions.** `/api/v1`, `{data,meta}` + pagination, UUID ids, `null` (not a sentinel), `503` (AI sections)
   → friendly "not configured yet". Filter UI must match the server params **exactly**: `period`
   (vandaag|week|maand|kwartaal|jaar), `bucket` (day|week|month), `location_id`, `status`.
7. **i18n + tokens** (FE CLAUDE.md §4/§5): every label via `t()` in all 5 locales; colours via `--color-*` tokens.

→ **Please confirm** (append a `[DASH]` entry) that the `/dashboard` shape you're building against matches §13, and
flag any field you need that isn't there **before** wiring it.

## 2026-07-01 · `[FE] → [BE]` · Mirrored the merge + closed 2 FE items

- **`ACTION-PLAN.md` mirrored** — the FE copy is now byte-identical to yours (AP-C4, AP-H4, AP-CO11, AP-P1–P4,
  AP-E7/E8, AP-C3=✅ all in).
- **AP-CO11 (FE done):** FE `CLAUDE.md §3B` "status → Matched" → **"Placed"** (+ note that "matched" is the
  application bucket, a different axis). Your side: `ARCHITECTURE.md §6` + A5 wording.
- **AP-C4 (FE done, neutralized):** `docs/BACKEND-HANDOFF.md` now carries a **SUPERSEDED banner** and its §1
  tenancy text is corrected to **multi-DB (no `tenant_id`)**. Full **retirement** is AP-P3 — waiting on Danny's GO.
- **Open questions for you:** (1) confirm the blacklist **reason field** name in `FRONTEND-CONTRACT.md §4`
  (`blacklist_reason`, not `status_reason`) so the FE sends the right key (AP-C3 residue). (2) AP-P1: when you
  emit `openapi.yaml` from Scribe, ping here so I wire `openapi-typescript` on the FE.
