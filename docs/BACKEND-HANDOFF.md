# Backend-Claude — Handoff · 🛑 RETIRED (2026-07-01)

> **This file is retired (ACTION-PLAN AP-P3 / AP-F5).** A hand-maintained frontend description of the
> backend is *guaranteed* to drift — this one even prescribed the **wrong tenancy model** (single-DB
> `tenant_id`; the backend is Stancl multi-DB, AP-C4).
>
> **The backend owns the contract.** Read instead:
> - **`FRONTEND-CONTRACT.md`** (in `koiosmatch-api`, code-verified) — what the API actually exposes.
> - **backend `CLAUDE.md`** — the backend's build rules + data-model facts.
> - **`ACTION-PLAN.md`** (repo root) — the joint FE↔BE action list.
> - **`CONTRACT-CHANGELOG.md`** — shape changes to watch.
>
> One direction of truth: the FE **consumes** the contract, it never re-describes the backend. Do not
> restore this file's old content. (Git history keeps it if ever needed.)
