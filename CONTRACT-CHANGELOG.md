# KOIOS MATCH — Contract Changelog (AP-P4)

> Every API **shape/endpoint change** (a new/renamed/removed field or endpoint) is logged here the moment it
> ships, so the other side reacts **before** it breaks. The backend **owns the contract** (`FRONTEND-CONTRACT.md`
> + `openapi.yaml` once emitted); this changelog is the **watch feed** both Claudes check on start-up.
>
> **DoD rule (AP-P4 — to bake into both `CLAUDE.md` at the next harden step):** a contract change is not *done*
> until (a) the Resource + its contract-snapshot test are updated, (b) `FRONTEND-CONTRACT.md` (and `openapi.yaml`
> once it exists) is regenerated **in the same commit**, and (c) an entry is added here. **No silent shape change.**
>
> **The FE decodes shapes in ONE layer** — the `mapX.js` mappers + `LookupsContext`; a change here touches one file.
>
> **Entry format** (newest first): `YYYY-MM-DD · [BE|FE] · <resource>.<field/endpoint> · <change> · <action for the other side>`

---

## Log

- **2026-07-01 · [BE] · `applications.stage`** · buckets derive from the **`is_match`/`is_rejected` flags**, never the key/label · **FE:** bind to the flags (AP-CO4). ✅
- **2026-07-01 · [BE] · `customers.name`** · `company_name` → **`name`** (codebase-wide) · **FE:** use `name` (AP-CO6). ✅
- **2026-07-01 · [BE] · `auth/me.roles`** · `string[]` → **`[{ name, dashboard_type }]`** · **FE:** read `.name`/`.dashboard_type` (AP-CO1, backward-compatible). ✅
- **2026-07-01 · [BE] · `dashboard_type` enum** · real values `admin·management·recruitment·planning·backoffice·sales·readonly` (**not** `recruiter`/`planner`); `super_admin → admin`, `admin` renders like `management` · **DASH:** switcher slugs (done, `b356d02`). ✅
- **2026-06-30 · [BE] · `candidates.status`** · **blacklist is now a status value** (`status === 'blacklist'`); the old `blacklisted` boolean was removed; reason = `blacklist_reason` (not `status_reason`) · **FE:** bind to the status value + `blacklist_reason` (AP-C3). ✅
- **2026-06-29 · [BE] · candidate axes** · single "status" split into **`phase`** (`candidate_phases`) + **`status`** (deployability); `availability` folded in; **no `inactive`** · **FE:** two pickers, flag-driven (v2 model, C-10/K-18). ✅

*(Going forward: append new shape changes above this line the same commit they ship.)*
