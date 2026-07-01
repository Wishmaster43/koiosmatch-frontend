# KOIOS MATCH — Joint Action Plan (Frontend + Backend)

> **One shared document.** Keep an **identical copy** (same name, same content) in
> `koiosmatch-frontend` and `koiosmatch-api`. FE-Claude and BE-Claude each drafted a plan; this is
> the merged, de-duplicated list we work off **together**. Tick items here as they close and keep
> both copies in sync.
>
> **Sources:** FE coherence review (DR-x) · BE architecture review (C/H/M-x) ·
> `FRONTEND-CONTRACT.md` (BE→FE, code-verified 2026-07-01) · both `DECISIONS.md`.
>
> **Owner:** `FE` = frontend-Claude · `BE` = backend-Claude · `BOTH` = coordinated (needs both sides,
> often a deploy window). **Status:** ☐ open · ◐ partial · ✅ done.
>
> **Rule of the road:** the **code wins**. `FRONTEND-CONTRACT.md` stays the FE's live contract; the two
> `DECISIONS.md` stay the decision logs. This file is only the *action list*. **Last merged:** 2026-07-01
> (BE placed the identical copy + 2 reconciliations: **AP-C3 confirmed/closed** against the live code, and
> **AP-F5 upgraded** — the FE `BACKEND-HANDOFF.md §1` tenancy model is *actively wrong*, not just stale.
> Mirror these two back into the FE copy so both stay identical).

---

## 0. Priority board (everything at a glance)

| ID | Issue | Sev | Owner | Status |
|---|---|:-:|:-:|:-:|
| **AP-C1** | ARCHITECTURE.md lags the code (both repos) | 🔴 | BOTH | ◐ FE done · BE open |
| **AP-C2** | Native Planning writes without invariants (corruptible schedule on `main`) | 🔴 | BE (FE-aware) | ☐ |
| **AP-C3** | **Blacklist representation mismatch** (boolean flag vs `status==='blacklist'`) | 🔴 | BOTH | ✅ resolved (residue → AP-C1) |
| **AP-C4** | FE `BACKEND-HANDOFF.md §1` prescribes the **wrong tenancy model** (single-DB `tenant_id`+global-scope) | 🔴 | FE | ☐ |
| **AP-H1** | module-gate ≠ authz — recurring class, not mechanically closed | 🟠 | BE | ☐ |
| **AP-H2** | Status-change provenance (effective_from + reason audit) incomplete | 🟠 | BE | ◐ |
| **AP-H3** | AI free-text guard = AVG go-live gate before tools read summary/notes | 🟠 | BOTH | ☐ |
| **AP-H4** | No global rate-limit on the authenticated API (only public routes throttled) | 🟠 | BE | ☐ |
| **AP-CO1** | `roles` → `[{name,dashboard_type}]` (was `string[]`) | 🟠 | BOTH | ☐ |
| **AP-CO2** | `branches[]` on candidates → fold single `location_id` | 🟡 | BOTH | ◐ |
| **AP-CO3** | D1 httpOnly-cookie auth flip (one atomic window) | 🟠 | BOTH | ☐ |
| **AP-CO4** | Flag-driven vocab — FE must not hardcode status/stage keys | 🟠 | FE | ☐ |
| **AP-CO5** | Lookup slug `value` + two lookup shapes | 🟡 | FE | ☐ |
| **AP-CO6** | Customers `company_name` → `name` | 🟡 | FE | ☐ |
| **AP-CO7** | 503 = "integration not configured yet", not a user error | 🟡 | FE | ☐ |
| **AP-CO8** | Base path `/api/v1` + envelope/pagination | 🔵 | FE | ☐ |
| **AP-CO9** | Planning shape: assignment **IS** a schedule, hours **on** the schedule | 🟡 | FE | ☐ |
| **AP-CO10** | Custom fields (C-29): FE built UI vs BE parked — decide together | 🟡 | BOTH+Danny | ☐ |
| **AP-CO11** | Placement status label: code sets **`placed`**; docs say "Matched" (v1 leftover) | 🟡 | BOTH | ☐ |
| **AP-P1** | Generate the contract from code — OpenAPI (Scribe) + FE TS types | 🟠 | BOTH | ☐ |
| **AP-P2** | Contract snapshot tests per resource (incl. `/dashboard` first) | 🟠 | BE | ◐ |
| **AP-P3** | One handoff direction — retire `BACKEND-HANDOFF.md`, backend owns the contract | 🟠 | BOTH | ☐ |
| **AP-P4** | Contract-change DoD rule + a watched CONTRACT-CHANGELOG | 🟠 | BOTH | ☐ |
| **AP-F1** | Wire the newly-built backend surfaces (big unblock) | 🟠 | FE | ☐ |
| **AP-F2..F8** | FE quality backlog (hooks/virtualization/a11y/docs/skills/memory) | 🟡 | FE | ◐ |
| **AP-E1..E8** | BE backlog (planning slices, AI key, HelloFlex, memory, route split, seeder, match_profiles) | 🟡 | BE | ◐ |
| **AP-M1/M4** | Doc-ownership + CLAUDE.md harden (after 0 findings) | 🟡 | BOTH | ☐ |

---

## A. CRITICAL

### AP-C1 · ARCHITECTURE.md lags the code — BOTH
The FE aligns to these docs, so an omission drifts silently (BE finding **C1** + FE finding **DR-1**).
- **BE:** add **Planning · Appointments · Opportunities C-42 · WhatsApp outbox · Outreach** to `koiosmatch-api/docs/ARCHITECTURE.md` (§2 graph + new sections); fix the §11 line counts. **Also fix the blacklist wording** in §5 + `CLAUDE.md §3` (they still say "blacklist = a flag" — the code made it a **status value**; see AP-C3).
- **FE:** ✅ **DONE (2026-07-01)** — `koiosmatch-frontend/docs/ARCHITECTURE.md §2/§3` rewritten to **v2** (phase + deployability, blacklist as a status value, availability folded, `inactive` gone); header + §6 lookup list synced; no stray v1 terms.
- **BOTH:** add "reconcile ARCHITECTURE.md" to the per-step Definition of Done so this can't recur.

### AP-C2 · Native Planning writes without invariants — BE (FE-aware)
`PlanningScheduleController` only guards double-booking (409). Missing: `number_persons` overbooking cap,
`unavailable`-on-date guard, client/location **blacklist** guard (BE finding **C2**; both DECISIONS confirm slice 2 unbuilt).
- **BE:** extract a `PlanningScheduler`/guard-service enforcing the three checks (**422**) on **`store` and `storeForShift`**; finish slice-4 isolation + guard tests. Until then, mark the write endpoints as risk.
- **FE:** build the UI but add client-side soft-guards + surface the WIP caveat; **do not rely on server validation** until slice 2 ships (contract **CO-9/§11**).

### AP-C3 · Blacklist representation mismatch — BOTH · ✅ RESOLVED
Found by cross-reading both repos. **BE confirmed against the live code (2026-07-01):** blacklist is a
**`status` value** (`status === 'blacklist'`); the old `blacklisted` **boolean was removed** (Golf ②,
2026-06-30); the reason is the **`blacklist_reason`** string (gated by `blacklist_reason_required`); hidden by
default, revealed with `?include_hidden=1`. `CandidateListResource` and the schema both confirm this.
- **BE:** ✅ `DECISIONS.md CA-3` corrected to "status value". Residual stale wording ("blacklist = a flag") in
  backend `ARCHITECTURE.md §5` + `CLAUDE.md §3` is folded into **AP-C1**.
- **FE:** ✅ already coded to `status === 'blacklist'` + `status_reason`; FE memory corrected (AP-F8). No change.

### AP-C4 · FE `BACKEND-HANDOFF.md §1` prescribes the WRONG tenancy model — FE *(new — BE finding R-1)*
`docs/BACKEND-HANDOFF.md §1` instructs the backend: "`tenant_id` FK on **every** tenant table + a **Global
Scope** on every model + indexes on `tenant_id`". **That is single-DB tenancy and is the opposite of how this
backend works.** Verified: this is **Stancl multi-DB** — isolation comes from the **connection**, there is
**no `tenant_id` column**, no `BelongsToTenant`, no tenant global scope (every tenant migration comments
"deliberately NO tenant_id"; `Location` "never uses BelongsToTenant"); central-only models are pinned with
`UsesCentralConnection`. This is **not just staleness** (AP-F5) — a BE-Claude that followed §1 would **break
isolation**.
- **FE:** rewrite §1 tenancy to the multi-DB reality (or retire `BACKEND-HANDOFF.md` and point at
  `FRONTEND-CONTRACT.md` + the backend `CLAUDE.md §4`, per AP-F5).

---

## B. HIGH

### AP-H1 · module-gate ≠ authz (recurring) — BE
Three audit rounds hit the same class (A-WF/A-AI/A-LOOKUP-AUTHZ). **BE:** add a route-scan test
(`route:list --json`) asserting **every write route under a `module:` group also carries a `permission:` gate**.
Closes the whole class structurally instead of per audit round (highest-leverage item).

### AP-H2 · Status-change provenance — BE
`status_reason` + `requires_reason` exist, but the dated **who/when/why** log (effective_from + reason →
audit entry, + `available_again_date` path) is only partial (BE **H2** / "Beslissing 15"). **BE:** confirm the
status transition writes an audit entry, or put the decision explicitly on the worklist as "consciously not".

### AP-H3 · AI free-text guard = AVG go-live gate — BOTH
The Koios-AI tool gateway (`executeToolCall`) is built + tested; advice-tools **may** read `summary` + note bodies.
The denylist + UI placeholder (T-new-2) is deferred "until a tool reads free text" — but the day the first such
tool goes live, special-category free text goes to the model **without a technical guard** (BE **H3** / **O-4**).
- **BE:** promote T-new-2 to a **hard go-live gate** before any free-text-reading tool + a test that fails if such a tool is enabled without the denylist.
- **FE:** wire the UI placeholder / redaction surface so recruiters see what is / isn't sent.

### AP-H4 · No global rate-limit on the authenticated API — BE *(new — security gap)*
Public/auth routes are throttled (login/MFA/candidate 5–120/min), but the authenticated **tenant `api`
group has no blanket `throttle:api`** (backend T10.5 flagged it as "still missing; could hit legit FE
traffic"). A compromised/looping client can hammer expensive tenant endpoints unbounded.
- **BE:** add a per-user/tenant global throttle on the `api` group (generous, so it never trips normal
  FE traffic), with a 429 that the FE already handles.

---

## C. Coordinated flips (BOTH — sync before shipping)

| ID | What | FE action | BE action |
|---|---|---|---|
| **AP-CO1** | `roles` = `[{name,dashboard_type}]` | Stop reading `roles[i]` as a string; use `.name`/`.dashboard_type` | Ships objects (C-35) — done; flip together |
| **AP-CO2** | Multi-branch `branches[]` | Move off single `location`/`location_id`; **signal BE when done** | Keeps `location_id` as primary until FE off it, then folds it away (CA-5) |
| **AP-CO3** | D1 cookie-auth | `withCredentials` + CSRF-priming + `VITE_COOKIE_AUTH=true` at flip | OPS-REDIS + `SANCTUM_STATEFUL_DOMAINS` + `/sanctum/csrf-cookie` (D1) — **one atomic deploy window** |
| **AP-CO4** | Flag-driven vocab (§0) | Audit + remove any hardcoded `'hired'/'rejected'/'placed'`/status-label → bind to `is_match/is_rejected/is_applicant/requires_match/is_won/is_lost/is_done/is_default` | Keeps returning the flag alongside label+colour |
| **AP-CO5** | Lookup slug + two shapes | Store the slug **`value`** (e.g. `note.type`), handle slug-lookups `{value,label,color}` vs name-lookups `{name,color,position}` (bare array) | Contract is stable (X-6) |
| **AP-CO6** | Customers `name` | Use `name` (was `company_name`) everywhere | Done (C-27) |
| **AP-CO7** | 503 handling | Treat HelloFlex/AI `503` as "not configured yet", friendly empty state | Returns 503-until-configured by design |
| **AP-CO8** | `/api/v1` + envelope | Verify the axios client uses `/api/v1`, `{data,meta}` + pagination, UUID ids, `null` (not sentinels) | Contract stable |
| **AP-CO9** | Planning model shape | Consume: an **assignment = a schedule row**, **hours live on the schedule** (no separate `planning_assignments`/`planning_hours` tables). Fix any FE code/worklist expecting them | Confirmed built this way |
| **AP-CO10** | Custom fields (C-29) | FE built the settings UI + treats it un-parked (K-27) | BE **parked** it (O-5). **Decide with Danny:** un-park (BE builds) or FE shelves the UI |
| **AP-CO11** | Placement status label | Bind to the `requires_match` flag / the `placed` value — never label it "Matched". Fix FE `CLAUDE.md §3B` ("status → Matched") | Code sets `placed` (`onMatched` → the `requires_match` status). Fix `ARCHITECTURE.md §6` + A5 wording "candidate → matched" → **placed** (the "matched" *bucket* name is the application bucket, a different thing) |

---

## D. Frontend backlog (FE)

- **AP-F1 · Wire the newly-built backend surfaces (big unblock).** Per `FRONTEND-CONTRACT.md`, these are now **live** and no longer "waiting on backend": **Appointments** (B-17) · **Applications/Match tab** + score/criteria (B-8) · **Opportunities C-42** zorg-fields · **Tasks** subtasks + links · **Outreach** page (new blueprint feature) · **Dashboard/Reports** · **Matches** drawer + `/activity` · **Planning** slice-1 read. Wire each to real endpoints; drop the mock/fallbacks.
- **AP-F2 · F-8** inline `api.*` + `useEffect` → feature hooks (~46 files).
- **AP-F3 · F-11** list virtualization (candidates/shifts, 10k+ rows) — scale blocker.
- **AP-F4 · A11Y-1** shared `Drawer`/`Modal` shell with focus-trap + `aria-modal` + focus-restore (~28 surfaces).
- **AP-F5 · DR-2** reconcile/retire `docs/BACKEND-HANDOFF.md` — it lists as "open" many things BE has **built**, **and** its §1 tenancy model is *actively wrong* (see **AP-C4**). Point the FE at `FRONTEND-CONTRACT.md` as the live BE→FE truth instead.
- **AP-F6 · M2** update the FE `/architect` + `/audit` **skills**: their status vocab is still v1 (`inactive`/`unplaceable`) → phase + deployability (else the review tool pushes good code back to a retired model).
- **AP-F7 · DR-5/6/7** worklist hygiene: de-duplicate the double `C-1` block; reconcile §F (stale: says files >400 / workflow-i18n open) with §G (done).
- **AP-F8 · M3** stale memory — ✅ **done** (`project_candidate_status_funnel_model` corrected to blacklist-as-status, 2026-07-01).

## E. Backend backlog (BE)

- **AP-E1 · Planning slices 2–4** — guards (= AP-C2), hours submit/approve, tests.
- **AP-E2 · AI** live scoring + reject-suggestion — 🔌 waiting on the Claude key (gateway exists) (O-7).
- **AP-E3 · HelloFlex** `hf_` source + contract field-spec — 🔌 waiting on creds/spec (O-8).
- **AP-E4 · M3** stale memories: `project_c10_funnel_status_model` (pre-v2 statuses in frontmatter) + `project_opportunities_contract` (notes = `author` string, not `author_id` — schema-verified).
- **AP-E5** `routes/api/tenant.php` ~890 lines — optional per-domain sub-split (LOW; it's a route manifest).
- **AP-E6 · Deferred (no action unless triggered):** onboarding/import (O-2), dynamic pools (O-3), custom fields (O-5 → AP-CO10), MySQL behavioural suite (O-6).
- **AP-E7 · Seeder completeness (C-0)** — confirm every lookup + realistic Yesway/demo data seeds idempotently in `dev:reset`, no empty screens (FE P0 depends on it).
- **AP-E8 · `match_profiles` naming** — the FE `match_profiles` concept (K-26) maps to the backend `assessment_criteria_groups` + `criteria_overrides` + per-vacancy `match_weights`. Confirm the contract + vacancy↔candidate parity (C-26.1/26.2); align the name in one doc so it stops reading as "missing".

## F. Docs & consistency (BOTH)

- **AP-M1 · Doc ownership.** One owner per topic to stop overlap-drift: **contract** → `FRONTEND-CONTRACT.md`; **model/entities** → `ARCHITECTURE.md`; **infra/topology** → `SYSTEM-ARCHITECTURE.md`; **decisions** → `DECISIONS.md`. Reference, don't repeat.
- **AP-M4 · CLAUDE.md harden — after a clean audit round** (both operating loops agree: only fold in patterns once a round finds 0). FE to bake: `page.<feature>` gating, `messaging.manage`, the flag-driven-vocab rule, a react-query/caching rule, the new entities (Planning/Outreach/Appointments/match_profiles) into §2/§3A, and COORD-1. BE to bake: central-users resolution, the 4-shape lookup taxonomy, the two test pitfalls, the native-planning data-fact, and module-gate≠authz.

---

## H. Drift prevention — so FE↔BE can't diverge again (BOTH) 🎯

> This is the answer to "fixing is one thing — it must not go wrong again, also not for the
> dashboards being built now". Every mismatch we found came from **hand-maintained prose docs
> drifting from code** and **two handoff docs pointing at each other**. The fix is to make the
> contract **machine-derived and machine-checked**, and to have **one direction of truth**.

- **AP-P1 · Generate the contract from code (kill the drift source).** The backend already runs
  **Scribe** (`knuckleswtf/scribe`). Export a machine-readable **OpenAPI** spec (`openapi.yaml`) from
  the real routes/Resources and publish it. The FE generates **TypeScript types** from it
  (`openapi-typescript`). Result: the FE **cannot** bind to a field the backend doesn't emit — a
  removed/renamed field becomes a **TS compile error**, not a runtime surprise. *(BE: emit openapi ·
  FE: generate + consume types.)*
- **AP-P2 · Contract snapshot tests per resource (CI gate) — dashboards FIRST.** The backend already
  has `CandidateApiContractTest`. Extend it to a snapshot per resource — **`/dashboard` + `/dashboard/charts`
  first** (Danny's concern; recall the FE once read a non-existent `by_funnel` key), then applications ·
  opportunities · tasks · planning · matches · vacancies · customers. The snapshot locks the exact JSON
  shape; changing a field **fails CI** → forces a conscious update + an FE ping. *(BE-owned.)*
- **AP-P3 · One handoff direction (retire the drift source).** The backend **owns the contract**
  (`openapi.yaml` + `FRONTEND-CONTRACT.md` as the human companion). **Retire `BACKEND-HANDOFF.md`** — a
  hand-maintained FE description of the backend is *guaranteed* to drift (it already had the wrong
  tenancy model, AP-C4). The FE **consumes** the contract; it never re-describes the backend.
- **AP-P4 · Contract-change DoD rule + a watched CONTRACT-CHANGELOG.** Add to **both** `CLAUDE.md`
  Definition-of-Done: *a contract change (new/renamed/removed field or endpoint) is not done until
  (a) the Resource + its contract snapshot test are updated, (b) `openapi.yaml` / `FRONTEND-CONTRACT.md`
  is regenerated in the same commit, and (c) it is logged in `CONTRACT-CHANGELOG.md` that the other side
  watches.* One line, enforced by CI (P2) — turns "remember to tell the FE" into a mechanical gate.

**For the dashboards specifically:** define the `/dashboard` shape in `FRONTEND-CONTRACT.md` **before**
the FE builds it (the shape is already sketched in §13 there), lock it with the AP-P2 snapshot, and the
FE binds only to documented keys (generated types enforce it). No dashboard field ships without a
snapshot + a doc line.

---

## G. Confirmed aligned (do **not** re-litigate — both sides agree)

- **Two candidate axes** (phase + deployability status), **no `inactive`**, **flag-driven** derivations. ✅
- **Match = 3 layers** (score on application · Match entity 1:N · contract in HelloFlex, store only guid+status). ✅
- **A-2 resolved:** Kans = **sales/CRM deal (reading a)** enriched with the C-42 zorg-detachering fields — BE reading (a)+C-42, FE K-24 agree. → close A-2.
- **Outreach = own entity** (not an overloaded task). ✅
- **Appointments · WhatsApp outbox · Opportunities C-42 · Tasks subtasks** = built and shape-verified. ✅
- **Source-prefix endpoints · soft-delete-only · migration-in-`create_` · watertight tenant-isolation (multi-DB, no `tenant_id`)** — agree. ✅
