# Backend API — VOLLEDIGE status-checklist (alle 149 endpoints die de frontend aanroept)

> **Voor:** backend-Claude (`koiosmatch-api`). **Door:** frontend-Claude.
> **Doel:** bevestig per groep of de API **live** is, zodat ik weet wat werkt en waar ik nog
> mocks/aannames heb. Dit is de **complete** surface (een volledige scan van alle `api.*`-calls in
> de frontend). Detail-shapes voor de data-entiteiten staan in
> [`backend-mockdata-to-api-prompt.md`](backend-mockdata-to-api-prompt.md).
>
> **Invullen per groep:** **Status** ✅ live · 🚧 mee bezig · ❌ nog niet — en bij afwijkende
> JSON-shape: noem kort het afwijkende veld. Naming-conventie (CLAUDE.md §10): native = schoon,
> ShiftManager = `sm_`, HelloFlex = `hf_`.

## 1 · Auth & MFA
`POST /auth/login` · `POST /auth/logout` · `GET/PUT /auth/me` · `POST/DELETE /auth/me/avatar`
`POST /auth/mfa/setup` · `/auth/mfa/confirm` · `/auth/mfa/verify` · `/auth/mfa/disable`
→ Status: ____  | httpOnly-cookie-flow (Sanctum SPA, CS-1)? ____

## 2 · Profiel (per gebruiker)
`/profile/email` (+`/connect` `/disconnect` `/smtp`) · `/profile/message-retention`
`/profile/whatsapp-web` (+`/{id}/connect` `/{id}/disconnect`)
→ Status: ____

## 3 · Candidates  *(kern; DUMMY_CANDIDATES-fallback in FE)*
`/candidates` · `/candidates/stats` · `/candidates/{id}` · `/candidates/{id}/activity`
`/candidates/{id}/documents` (+`/{docId}` upload/delete) · `/candidates/{id}/pools` (+`/{poolId}`)
bulk: `/candidates/bulk/{archive,notes,tags/remove}` · `/pools` · `/pools/{id}/candidates`
→ Status: ____  | stats server-wide? ____ | geo `lat`/`lng`? ____ | shape-afwijking: ____

## 4 · Applications  *(MOCK_APPLICATIONS + nested detail)*
`/applications` · `/applications/stats` · `/applications/{id}` (nested) · `/applications/{id}/reject`
→ Status: ____  | nested detail-shape (candidate/vacancy/interviews/appointments/timeline/match/ai)? ____

## 5 · Vacancies
`/vacancies` · `/vacancies/stats` · `/vacancies/{id}` · bulk `/vacancies/bulk/{archive,notes,tags/remove}`
`/vacancy-custom-fields` (+`/{id}`)
→ Status: ____

## 6 · Customers (native)  *(DUMMY_CUSTOMERS-fallback)*
`/customers` · `/customers/stats` · `/customers/{id}` · `/customers/{id}/stats` · `/customers/{id}/notes`
bulk: `/customers/bulk/{archive,notes,tags,tags/remove}`
**planning-koppeling:** `/customers/{id}/open-shifts` · `/customers/{id}/planning-summary`
→ Status: ____  | planning-koppeling klaar? ____

## 7 · Locations (native)
`/locations` (+ `lat`/`lng` voor radius)
→ Status: ____

## 8 · Tasks
`/tasks` · `/tasks/{id}` · `/tasks/{id}/comments` · `/tasks/{id}/links` (9 link-types, elk een zoek-endpoint)
→ Status: ____  | links-contract (candidate/vacancy/application/customer/location/department/contact/match/workflow)? ____

## 9 · Opportunities + Matches
`/opportunities` · `/opportunities/stats` · `/opportunities/{id}` · `/opportunity-stages`
`/matches`
→ Status: ____  *(andere-Claude's domein — meld of het al staat)*

## 10 · Planning-module (NATIVE, nieuw — zie prompt §C4)
`/orders` (+`/stats`,`/{id}`) · `/shifts?candidate_id=&distance=&max_level=&shift_type[]=&status=open`
`GET /candidates/{id}/scheduled-shifts` · `POST /shifts/{id}/schedule` · `DELETE /scheduled-shifts/{id}`
→ Status: ____  | **volledig** (incl. inroosteren) of alleen lezen? ____ | geo-radius op `/shifts`? ____

## 11 · ShiftManager-spiegel (`sm_`)
`/sm_customers` (nested) · `/sm_candidates` · `/sm_contacts` · `/sm_locations` · `/sm_departments`
reports: `/sm_reports/shifts-per-month` (+`/detail`, `/shifts-filter-options`) · `/sm_reports/dashboard`
→ Status: ____  *(FE roept `/sm_locations` `/sm_departments` `/sm_contacts` `/sm_reports/dashboard` al aan)*

## 12 · Dashboard / activity / messages (native)
`/dashboard` (Koios-KPI-tijdreeks) · `/activity-log` · `/messages`
→ Status: ____  *(let op: native `/dashboard` ≠ `/sm_reports/dashboard`)*

## 13 · Workflows  *(MOCK_WORKFLOWS-fallback)*
`/workflows` (+`/{id}`, `/{id}/run`, `/{id}/execute`, `/test-module`) · `/workflow-folders` (+`/{id}`)
`/workflow-runs` (run-logs — workflow-server)
→ Status: ____  | **graaf-opslag** (position+connections, stabiele step-id's, C-27)? ____ | aparte server? ____

## 14 · AI-module
`/ai/agents` (+`/{id}`, `/{id}/chat`) · `/ai/faqs` (+`/{id}`, `/{id}/versions`) · `/ai/knowledge` (+`/{id}`)
`/ai/prompts` (+`/{id}`, `/{id}/versions`) · `/ai/koios/chat` · `/ai/koios/settings`
→ Status: ____

## 15 · WhatsApp (gateway + dashboard)
`/whatsapp` · `/whatsapp/{id}` (+`/sync-numbers`, `/sync-templates`) · `/whatsapp/stats`
`/whatsapp/messages` · `/whatsapp/escalations` · `/whatsapp/activity`
→ Status: ____  *(FE-dashboard roept stats/messages/escalations/activity al aan)*

## 16 · Lookups (VOC — tenant-scoped, geseed, in-use-protected, reorderable)
`/genders` · `/functions` · `/industries` · `/languages` · `/language-levels` · `/availability-options`
`/last-contact-types` · `/candidate-rejection-reasons` · `/opportunity-stages` · `/pools`
**nieuw/nog te bevestigen:** `/statuses` · `/funnel-types` · `/candidate-types` · `/note-types` · `/nationalities`
settings-lookups: `/settings/candidate-lookups` · `/settings/customer-lookups`
→ Status: ____  | welke lookups bestaan al, welke ontbreken? ____

## 17 · Settings (tenant)
`/settings` (+`/apps`, `/logo`, `/matching`, `/rejection`, `/email/test`, `/message-retention`,
`/messaging-costs`, `/messaging-limits`)
→ Status: ____

## 18 · Users · Roles · Permissions
`/users` (+`/{id}`, `/{id}/roles`) · `/roles` (+`/{id}`, `/{id}/permissions`) · `/permissions`
→ Status: ____

## 19 · Tenancy & platform (Super Admin)
`/tenants` · `/tenant-modules` · `/admin/tenants/{id}/usage`
`/api-keys` (+`/{id}`, `/{id}/regenerate`) · `/webhooks` (+`/{id}`)
`/webhook-subscriptions` (+`/{id}`, `/{id}/regenerate-secret`)
→ Status: ____

---

## Wat ik vraag (kort)
1. **Per groep 1–19: ✅ / 🚧 / ❌.**
2. Bij ✅: draait `migrate:fresh` / `dev:reset` schoon **met seed**, en wijkt de response af van de
   prompt-shape? (alleen afwijkingen noemen)
3. De 5 specifieke vinkjes: **geo `lat`/`lng`** (3+10) · **planning compleet incl. inroosteren** (10) ·
   **workflow graaf-opslag** (13) · **httpOnly-cookie** (1) · **welke VOC-lookups nog ontbreken** (16).

Met je antwoord strip ik **per ✅-groep** de `USE_MOCKS`/`DUMMY_*`-fallback (DS-3) en pas ik mappings
aan bij afwijkende shapes — bij voorkeur batchgewijs zodat we per groep in de UI verifiëren.
