# Koios Match — Werklijst (Danny · Frontend · Backend)

> **Eén levende bron** voor alle openstaande taken. Claude werkt dit bij elke sessie bij.
> Dit vervangt alle losse `backend-prompt-*.md` / `backend-worklist.md` bestanden.
>
> **Laatst bijgewerkt:** 2026-06-21 · door frontend-Claude — laatste: per-recruiter-donut
> gefixt + recruiter-kleurkiezer (B-5/B-11), C-12 verkleind, "In uitvoering"-kop hersteld.
> **Sectie E** = de volledige brain-dump van Danny, per domein opgesplitst in
> **[FE]** frontend / **[BE]** backend / **[D]** Danny. A/B/C blijven de actieve,
> uitgespecificeerde items; E is de bredere backlog die daarin opgaat.
> **Conventies:** Engels in code, `snake_case` in de API, tenant-scoped, AVG /
> special-category (gezondheid) — behandel data navenant. Lijst-responses mogen
> bare array of `{ data, meta }` zijn; detail bare object of `{ data }`.
> **Backend-status** gepeild op `koiosmatch-api.test` (401 = bestaat, 404 = nog bouwen).
> **Peiling 2026-06-21:** LIVE (401) = `/api-keys`, `/settings/messaging-limits|costs|message-retention`,
> `/candidates/stats`, `/locations`, `/crm/customers`. Nog 404 = `/webhook-subscriptions`,
> `/webhook-events`, `/industries`, `/functions`.
>
> **Legenda:** ☐ open · ◐ deels / te verifiëren · ✅ klaar

---

## A. Voor Danny — beslissingen & acties

Dingen die alleen jij kunt beslissen of testen.

- [ ] **Testen na backend-werk** (zodra de endpoints live zijn):
  - Locatie aanmaken met álle velden → refresh → blijven ze staan? (zie C-6)
  - *Personalisatie → Industries*: branche toevoegen → verschijnt in de Industrie-dropdown bij *Bedrijf*? (zie C-7)
  - Vacature status/fase **toevoegen + reorder** met een ingelogde sessie.
- [x] **Besloten — status/funnel-model (bijgewerkt 2026-06-21).** Twee losse assen.
  **Status (de persoon) = Lead → Kandidaat** (configureerbaar; later evt. Inactief/Archief),
  **hybride** gestuurd (recruiter zet meestal zelf, acties kunnen 'm zetten). **Funnel-fase = per
  sollicitatie** (Gesolliciteerd → Uitgenodigd → Voorstel → Aangenomen/Afgewezen), bewerkbaar op de
  sollicitatie. **"Sollicitant" is géén aparte status** — het is afgeleid: een Kandidaat met ≥1
  lopende sollicitatie (kan meerdere tegelijk + opnieuw). De funnel toont zich zodra er een
  sollicitatie is, niet op een status-vlag. Op de kandidaat alleen **read-only fase-chips**.
  Volledig model: memory `project_candidate_status_funnel_model`. Frontend = B-8/B-10; backend = C-10.
- [ ] **Beslissing — adres bij locaties.** Frontend heeft 'm al compacter gemaakt
  (straat + huisnr + toevoeging op één regel). Zo houden of nog anders?
- [ ] **Beslissing — terminologie.** Heet het "vacancy" of "vacature + sollicitatie"?
  Consistente naamgeving doorvoeren zodra je kiest.
- [ ] **Beslissing — hosting WhatsApp-gateway.** EU (Hetzner, goedkoop, AVG-OK) vs
  strikt NL (premium). Je gaf aan meer info nodig te hebben — vraag het uit wanneer relevant.
- [x] **Besloten — endpoint-naamgeving (2026-06-21).** **Basis-Koios = schone namen** zonder prefix:
  `customers`, `candidates`, `locations`, `departments`, `contacts`. **ShiftManager-bron = `sm_`-prefix:**
  `sm_customers` (enz.), zodat de basisnamen vrij zijn. Gevolg-werk (gecoördineerd, samen live zetten):
  - **Backend (C-17):** `/crm/candidates` (deprecated) weg; `/crm/customers` → **`/customers`**;
    `/sm/customers` → **`/sm_customers`** (+ `/sm_customers/sync`).
  - **Frontend (B-15):** `/crm/customers` → `/customers` (`CustomersPage`, `BranchSection`); alle
    `/sm/customers*` → `/sm_customers*` (ShiftManager-pagina's/rapporten + `SyncSettings`).
- [ ] **Doorgeven aan backend-Claude:** sectie **C** van dit bestand (repo-pad
  `/Users/danny/Herd/koiosmatch-frontend`, bestand `docs/worklist.md`).
- [ ] **Git:** alles naar `main` (geen feature-branches — jouw workflow).

---

## B. Frontend-Claude — open

- [ ] **B-1 · E-mail per context (UI).** Backend is klaar met 3 onafhankelijke
  afzenders (**klanten / kandidaten / planning**) + een **default**-groep als fallback,
  elk met eigen Gmail/Office/SMTP-account en handtekening. Bouw/repareer de
  instellingen-UI: 4 panelen/tabs, provider-keuze, handtekening-editor, default-fallback.
  *(Volledig contract stond in de prompt van 2026-06-20; volg dat exact, gok geen keys.)*
- [ ] **B-2 · Koios AI (frontend) — ◐ chat + settings (B) klaar.** Het `KoiosPanel`
  hangt nu aan het echte contract (`POST /ai/koios/chat` → `answer`/`steps`/`usage`/`stop_reason`;
  logica in `components/layout/koios/useKoiosChat.js`), met `steps` (org/rechten kleur-gecodeerd),
  `usage`, rustige `not_configured`/403-states, **model-picker** uit `GET /ai/koios/settings`
  en header-status op `claude_configured`. Sidebar-toggle **gegate** op `koios_ai` + `koios.use`
  (fail-open). Scherm **B — Koios-instellingen** gebouwd (`pages/settings/sections/koios/`:
  status/modellen/tarieven, registry `integrations → koios`, namespace `koios.json` ×5).
  **Rest:** scherm **C** (verbruik: `GET /ai/koios/usage`), scherm **D** (super-admin:
  `/admin/usage` + `/admin/prompts`), model-picker live testen, paperclip/upload. Wacht deels
  op backend: bevestig Koios-veldnamen + `koios_ai`/`koios.use` in `/auth/me` + evt. `page.koios`.
- [ ] **B-3 · Bulk-actie-menu — ◐ fase 1 (FE) klaar, wacht op backend.** Het
  "Massa mutaties"-menu (`CandidatesBulkBar` + generieke `ActionMenu` met drill-in:
  zoeklijst-, submenu- én vrije-tekst-node) staat met: eigenaar wijzigen · pool
  toevoegen/verwijderen (gegroepeerd) · funnel-fase · kandidaat-type · **tag
  verwijderen** · **notitie toevoegen** · **archiveren (soft-delete)**. Set-acties
  via één generieke `bulkMutate` (optimistisch + reconcile op `updated`/`skipped`).
  Archiveren is **autorisatie-gated** in de UI (`hasPermission('candidates.delete')`
  + `window.confirm`); backend her-checkt. Tests: `ActionMenu.test` + `CandidatesBulkBar.test`.
  **Rest open:** tag *toevoegen* (creatable), koppelen aan vacature, vestiging/branch
  (E1 · Bulk-acties / fase 2). **Blokkeert op backend C-15** — endpoints bestaan nog
  niet, dus de acties tonen een nette foutmelding + revert tot ze live zijn.
- [x] **B-4 · API-keys: scopes/rechten in de aanmaak-modal — klaar.** Scopes (per entiteit
  read / read_write) staan nu in de aanmaak-modal én het Toegang-tab via één gedeelde
  `ScopeEditor` (`src/pages/settings/sections/apikeys/`). (zie C-5a)
- [x] **B-5 · `GET /candidates/stats` veldnaam-mismatch — opgelost (frontend).**
  Broncode bevestigt: backend geeft `by_status` → `status`, `by_funnel` → `funnel_type`,
  `by_owner` → `owner_id` (níet `value`/`id`). Dáárdoor was de "Per recruiter"-taart leeg.
  Frontend leest nu defensief beide vormen (`o.value ?? o.status` enz.) in
  [CandidatesPage.jsx:157-180](src/pages/candidates/CandidatesPage.jsx#L157-L180). Backend-
  alignment (C-9) is nu nog slechts *nice-to-have*, niet meer blokkerend.
- [x] **B-11 · Recruiter-kleur (avatar_color) — gebouwd & werkend.** Kleurkiezer op de
  gebruiker (**Beheer → Gebruikers**): klik op het avatar → zacht palet (`COLOR_PRESETS`,
  nu in [src/lib/colorPresets.js](src/lib/colorPresets.js)) + "Automatisch" (reset). Slaat
  optimistisch op via `PATCH /users/{id} { avatar_color }` (endpoint bestond al → werkt
  vandaag). [UsersPage.jsx](src/pages/users/UsersPage.jsx) `EditableAvatar` + `setColor`.
  **Rest = C-12:** zolang de backend `avatar_color` niet meegeeft in de owner-payload van
  `/candidates`, reflecteert het eigenaar-icoon in de *kandidatentabel* de kleur nog niet
  (in *Gebruikers* zelf wél).
- [ ] **B-6 · Webhooks-filter-UI verifiëren.** UI draait op fallback-data; zodra
  `/webhook-subscriptions` + `/webhook-events` live zijn (C-5b): event-filtering testen.
  *(Peiling 2026-06-21: beide nog 404 — wacht op 5b.)*
- [ ] **B-7 · WhatsApp Web (persoonlijk) onder Profiel — ◐ frontend klaar.** Per-gebruiker
  QR-koppeling (onofficiële gateway), los van WhatsApp Business. Frontend gebouwd
  (`src/pages/auth/whatsappWeb/` + `ProfileWhatsAppWeb.jsx`); endpoints staan in het A2-contract
  (`/profile/whatsapp-web` + connect/disconnect/delete, status incl. `connecting`) — live
  verifiëren zodra de gateway draait.
- [ ] **B-8 · Sollicitatie-tab op de kandidaat.** Tab met match-score (Koios AI) +
  AI-afwijsreden + de bewerkbare funnel-fase per sollicitatie. Read-only fase-chips
  staan al in de drawer-header (`ApplicationStageChips`, wacht op `candidate.applications`
  uit C-10). Hangt op B-2 en C-8/C-9/C-10.
- [ ] **B-10 · Status/funnel-model doortrekken (frontend) — herzien 2026-06-21.** Status-lookup =
  **Lead → Kandidaat** (Prospect/Sollicitant eruit). Funnel tonen op basis van **lopende sollicitaties**
  (`candidate.applications` niet leeg), níet op de `is_applicant`-vlag → de huidige `isApplicantStatus`-
  gating in `CandidateDrawer`/`CandidatesTable` + de "Toont de sollicitatie-funnel"-toggle kunnen
  vervallen. `AddCandidateModal` losmaken van funnel-als-primaire-keuze. Wacht op C-10.
- [ ] **B-9 · Profiel: gekoppelde rollen + persoonlijke e-mail.** Rollen van de
  ingelogde gebruiker tonen; persoonlijke mailkoppeling (Gmail/O365/SMTP). Verifiëren
  wat al staat t.o.v. B-1.
- [ ] **B-12 · Messaging-schermen + outreach-widget afmaken — ◐ endpoints live.** Messaging-settings
  (Limieten/Kosten/Bewaartermijn, `src/pages/settings/sections/messaging/`) draaien defensief op
  **aangenomen** shapes; de endpoints zijn nu **LIVE (401, peiling 2026-06-21)** → verifiëren tegen
  echte responses + shapes bevestigen (C-13). Outreach-conversiewidget (`GET /candidates/{id}/outreach`)
  nog te bouwen zodra de shape er is (C-13).
- [ ] **B-13 · Functie als lookup-combobox uitrollen.** Besloten: combobox +
  `allow_free_entry`-toggle per tenant, één veld (geen `function_string`/`function_drop`).
  Fundament staat (`lib/useFunctions.js` + `components/ui/CreatableSelect.jsx`, gekoppeld in
  de kandidaat-header; **default `allowFreeEntry=true`** → nu vrije invoer, niet geconfigureerd).
  **Rest:** Voorkeuren (`function_pref`), candidates-table filter, vacature-functie; hardcoded
  `ALL_FUNCTIONS`/`FUNCTION_LEVELS` vervangen. **De toggle bestaat nog NIET in de UI** → bouw
  sectie **Instellingen → Personalisatie → Functies** (mirror `IndustrySettings`, naast "Industries")
  met de lijst + de toggle. **Toggle-guard (besloten):** naar *strikt* (dropdown) zetten mag alléén als
  álle bestaande functie-waarden in de lijst voorkomen; zo niet → toon een **werklijst van afwijkende
  kandidaten/vacatures** die eerst aangepast moeten worden, en blokkeer de instelling tot het schoon is
  (preflight uit C-14). Terug naar *vrij* mag altijd. Wacht op C-14.
- [ ] **B-14 · Audit log verder uitbreiden.** Standalone categorie + CSV-export + load-more
  paginering staan al. **Rest (frontend):** entiteit/IP-kolom + entiteit-filter + drill-down
  per type uitbreiden (#3); fetch laten respecteren `activity_log_limit` (Modules→Shiftmanager);
  **per-kandidaat changelog-tab** op de kandidaat (#10/#4) die `/candidates/{id}/activity` toont.
  Hangt op C-16.
- [ ] **B-15 · Endpoint-rename doortrekken (gecoördineerd met C-17).** Native schoon, ShiftManager `sm_`,
  HelloFlex `hf_` (CLAUDE.md §10). Frontend-calls aanpassen volgens de audit: `/crm/customers` →
  `/customers` (`CustomersPage`, `BranchSection`); `/sm/customers*` → `/sm_customers*` (`SyncSettings`
  + `pages/shiftmanager/*`); `/sm/candidates` → `/sm_candidates`; `/sm/reports/*` → `/sm_reports/*`
  (`components/reports/*` + `pages/shiftmanager/*Report`). **Pas omzetten als C-17 live is** (geen
  fallback → anders 404). Wacht op C-17.

### ◐ Recent afgerond aan de frontend (ter context)
**KPI's = eigen settings-menu** (uit groep "Algemeen" gehaald) · **2FA/Security verplaatst naar het
eigen Profiel** (tab "Beveiliging"; weg uit org-instellingen — MFA is per-gebruiker) ·
Industrie instelbaar (lookup + `useIndustries`, wacht op C-7) · locatie-formulier
volwaardig (straat/huisnr/toevoeging/postcode/plaats/land + KvK/BTW/contact, wacht op C-6) ·
"Adresregel 2" verwijderd · placements → **matches** (UI + code + endpoint, backend moet
hernoemen, zie C-8) · bulk pool add/remove met optimistische update · zacht kleurenpalet ·
funnel-picker uit de drawer-header + soft pills/avatar + profiel in 3 kaarten +
Voorkeuren/ZZP gegroepeerd + read-only sollicitatie-fase-chips + opt-in/toestemmingen
(WhatsApp/e-mail/nieuwsbrief) in Communicatie-tab (rust-redesign + #34) ·
Koios AI-blok rustiger + `KoiosAiMark` (brain-circuit) in sidebar-knop, AI-blok & Koios-tabelkolom ·
Functie-veld → creatable combobox-fundament (`useFunctions` + `CreatableSelect`, gekoppeld in
kandidaat-header, wacht op C-14) · adres bij locaties compacter · potlood/diskette-edit overal ·
Instellingen: nieuw **Modules**-kopje (tabs Shiftmanager + HelloFlex); "Weergave"-limieten
verhuisd naar Modules→Shiftmanager; Beheer→Modules hernoemd naar "Pakket"; Beheer gesplitst in
**Beheer** (rollen/gebruikers) + **Super Admin** (Pakket) + losse **Audit log**-categorie
(met CSV-export + load-more). **Shiftmanager-module** kreeg **sub-tabs** (KPI's[stub] · Weergave ·
Synchronisatie); **Sync** verhuisd uit Beheer → Shiftmanager; **Apps (connectors)** verhuisd
Super Admin → Integraties. **Shiftmanager-KPI's gebouwd** (eigen `sm_*`-schema, geen stub meer
— backend krijgt 5 nieuwe keys). Rol-dropdown-pijltje (Gebruikers) gefixt (portal i.p.v.
afgekapt door overflow). Potlood/in-place-edit op inkomende webhooks (PATCH /webhooks/{id}).
App store-tab verwijderd. Import-subnav: CV's→Documenten + Klanten + Diensten toegevoegd ·
Talen/Niveaus/Geslacht-lookups · per-module zichtbaarheid (planning-tab/sidebar) ·
**API-keys-sectie** (lijst + detail Algemeen/Toegang + scopes-bij-aanmaken + IP-whitelist +
secret 1×/regenerate) · **uitgaande webhooks** + event-filter (`EventCatalog`, inkomend behouden) ·
**messaging-settings** (Limieten/Kosten/Bewaartermijn, Communicatie → Berichten) ·
**attention-tile `never_contacted`** + `stale`/`never_contacted` op server-counts uit `stats.attention` ·
**bulk-acties fase 1** (eigenaar · funnel-fase · kandidaat-type · tag verwijderen · notitie · archiveren) op
generieke `ActionMenu` + `bulkMutate`, met autorisatie-gate op archiveren (wacht op C-15). ·
**Per-recruiter-donut gefixt** (defensieve stats-lezers, B-5) · **recruiter-kleurkiezer** in *Beheer → Gebruikers* (B-11) + palet naar `lib/colorPresets.js`. ·
**Beschikbaarheid (availability) als aparte as** (A4): lookup-sectie *Personalisatie → Beschikbaarheid* (`/availability-options`) + drawer-picker los van status; `LookupsContext`+`mapCandidate`+PATCH `availability`. `is_applicant`-funnel-gating zat al in de drawer.

---

## C. Backend-Claude — open

Tenant-scoped, special-category (gezondheid). Secrets nooit loggen.

### ☐ C-1 · Lookups — "in gebruik"-vlag + 409 + demo-data  ◐ grotendeels klaar, verifiëren
De backend meldde dit afgerond (in_use-vlag + 409 + demo-seed + vacancy-endpoints gefixt).
**Te verifiëren met ingelogde sessie:** vacancy status/fase **toevoegen + reorder** werkt,
en `in_use` zit op élke lookup-GET (genders, languages, language-levels, pools,
candidate-lookups, rejection-reasons, vacancy-statuses/-phases/-custom-fields).

### ☐ C-2 · Kandidaat sub-entiteiten — body-contracten bevestigen
Routes (per kandidaat): `POST /candidates/{id}/{rel}` · `PATCH …/{rel}/{eid}` ·
`DELETE …/{rel}/{eid}`. Na `POST` het record incl. `id` teruggeven; frontend vervangt
z'n tijdelijke negatieve id. Zet deze velden in de FormRequest/`$fillable` (of hernoem kolommen):

- **experiences** — `function_title, employer, location, start_date, end_date, current (bool), description`
- **educations** — `title, school, start_date, end_date, in_progress (bool), description, issue_date`
- **certifications** — `name, organisation, issue_date, expiry_date, license_number, description`
- **skills** — `name, level`
- **matches** *(was "placements")* — `client, function_title, scale, step, hourly_rate, hours_per_week, start_date, end_date, contract_type, contract_duration` (zie C-8)
- **languages** — hele array in `PATCH /candidates/{id}`: `{ languages: [{ language, spoken, written }] }`
- **preferences** — nested in `PATCH /candidates/{id}`: `{ available_from, hours_per_week, preferred_days, max_travel_km, max_travel_min, has_license, own_transport, function_pref, sector_pref, min_rate, contract_pref, remarks }`
- **zzp** — nested: `{ company_name, kvk_number, vat_number, kor, intracommunautair, street, house_number, postal_code, city, country, creditor_number, business_email, invoice_email, iban, self_billing, payment_discount, mediation_costs, payment_term }`

### ✅ C-3 · Kandidaat — Documenten (multipart upload) — BACKEND KLAAR (2026-06-21)
Verhuisd van `/crm/...` naar het **schone pad** `/candidates/{id}/documents`. Geleverd + getest:
- `GET    /candidates/{id}/documents` → `[{ id, name, type, size, url, uploaded_at }]` (perm `candidates.view`).
- `POST   /candidates/{id}/documents` — `multipart/form-data`: `file`, `type`, `name` → `201 { id, name, type, size, url }` (perm `candidates.update`).
- `PATCH  /candidates/{id}/documents/{docId}` — `{ name }` (hernoemen).
- `DELETE /candidates/{id}/documents/{docId}` → 204.
- `GET    /candidates/{id}/documents/{docId}/download` — geautoriseerde, tenant-gescoped stream (= de `url`-waarde); bestand NOOIT publiek, alleen via ingelogde sessie.
- GET-detail levert `documents: [{ id, name, type, size, url }]` (zelfde shape).
- ✅ **Frontend bevestigt:** `type` = vrije string is prima. Frontend stuurt één **vaste waarde uit
  `DOC_TYPES`** (`CV` · `ID-bewijs` · `Diploma` · `Contract` · `VOG` · `Certificaat` · `Overig`) — geen
  vrij getypte tekst, geen lookup-id. Backend hoeft onbekende waarden niet te weigeren (lijst kan groeien).
  *(Evt. later tenant-lookup; nu niet nodig.)*

### ☐ C-4 · Kandidaat — Branches (kandidaat ↔ klant/vestiging)
Het "Vestiging"-blok koppelt een kandidaat aan klanten uit `GET /crm/customers`.
Frontend wacht op het contract (bewust niet gegokt — ids vs namen):
- Kies + documenteer `POST /candidates/{id}/branches` `{ customer_id }` +
  `DELETE /candidates/{id}/branches/{customerId}`, GET-detail `branches: [{ id, name }]`.
- Laat de gekozen key (`customer_id` of `branch_id`) + of het een pivot is weten.

### ◐ C-5 · Integraties — API-keys (scoped) + uitgaande webhooks
UI is af. **Peiling 2026-06-21: `/api-keys` is LIVE (401) ✅** — 5a grotendeels klaar, verifiëren met
ingelogde sessie. **`/webhook-subscriptions` + `/webhook-events` nog 404** → 5b nog te bouwen.
Alles tenant-scoped; secrets nooit loggen.
> **Niet breken:** bestaande inkomende `/webhooks` (token-URL → workflow-trigger) blijft
> ongewijzigd. Nieuwe uitgaande abonnementen op apart pad `/webhook-subscriptions`.

**5a. API-keys** — tabel `api_keys` (tenant-scoped): `id (uuid)`, `tenant_id`, `friendly_name`,
`type` (`primary|additional`), `organisation?`, `description?`, `guid` (publiek key-id),
`secret_hash` (**alleen hash**), `status` (`active|disabled`), `contact_name?`, `contact_email?`,
`allowed_ips?` (json, leeg = geen restrictie), `last_used_at?`, timestamps.
Scopes = `{ entity: level }` met `read | read_write`. Entiteiten: `candidates, customers,
locations, departments, contact_persons, vacancies, applications, orders, shifts,
shift_schedulings, contracts, documents, reporting`.
```
GET    /api-keys            → [ { id, friendly_name, status, type, organisation, guid, created_at, updated_at } ]  (GEEN secret)
POST   /api-keys            { friendly_name, type, organisation?, description?, contact_name?, contact_email?, allowed_ips?[], scopes?{entity:level} }
                            → 201 { ...velden, guid, scopes, allowed_ips, secret }   (secret plaintext, 1×)
GET    /api-keys/{id}        → { ...velden, scopes, allowed_ips, contact_* }          (GEEN secret)
PUT    /api-keys/{id}        (alles optioneel) → { ...updated }
DELETE /api-keys/{id}        (intrekken; soft/hard documenteren)
POST   /api-keys/{id}/regenerate → { secret }   (1×; oude vervalt)
```
Inbound: `Authorization: Bearer <guid>.<secret>` óf `X-Api-Key`; verifieer tegen `secret_hash`;
IP-whitelist (CIDR) anders 403; scope-enforcement (GET=read, schrijf=read_write) anders 403;
`last_used_at` throttled; `disabled` → 401/403; audit (`apikeys`) zonder secret/PII.

**5b. Uitgaande webhooks** — tabel `webhook_subscriptions` (tenant-scoped): `id`, `tenant_id`,
`name`, `url` (https), `status`, `signing_secret_hash` (HMAC-SHA256; plaintext 1×),
`event_types` (json), `last_triggered_at?`. Optioneel `webhook_deliveries` voor retries.
Event-catalogus (exacte keys):
```
candidate.created  candidate.updated  candidate.deleted
candidate.status_changed  candidate.funnel_type_changed
customer.created  customer.updated  customer.deleted
location.created  location.updated  location.deleted
contact_person.created  contact_person.updated  contact_person.deleted
vacancy.created  vacancy.updated  vacancy.deleted
order.created  order.updated  order.deleted
shift.created  shift.updated  shift.deleted
shift.scheduling.created  shift.scheduling.updated  shift.scheduling.deleted
```
```
GET    /webhook-events           → [ { key, group } ]
GET    /webhook-subscriptions    → [ { id, name, url, status, event_types[], last_triggered_at } ]  (GEEN secret)
POST   /webhook-subscriptions    { name, url, event_types[] } → 201 { ...id, status, secret }   (1×)
GET    /webhook-subscriptions/{id} · PUT (optioneel) · DELETE
POST   /webhook-subscriptions/{id}/regenerate-secret → { secret }   (1×)
```
Aflevering async via queue; payload `{ id, type, created_at, tenant_id, data:{…} }`
(dataminimalisatie). Headers `X-Koios-Signature: sha256=<hmac>`, `X-Koios-Event`,
`X-Koios-Delivery`. Retries met backoff, timeout 5–10s, **SSRF-guard**. Audit (`webhooks`) zonder PII.

### ☐ C-6 · Locaties — gestructureerde velden  *(NIEUW)*
Frontend stuurt nu een volwaardige locatie. Pas `POST /api/locations` + `GET /api/locations`
aan (tenant-scoped). Velden naast `name` (required): `street, house_number,
house_number_suffix, postal_code, city, country, coc_number (KvK), vat_number (BTW),
contact_name, phone, email`. `email` → `nullable|email`. GET geeft alle velden terug +
`id` + `created_at`. Houd legacy `address`/`full_address` werkend als fallback.

### ☐ C-7 · `/api/industries` lookup  *(NIEUW)*
Zelfde opzet als `/genders` (tenant-scoped CRUD-lookup). Velden: `id`, `name` (required),
`position` (sortering). GET → `{ data: [...] }`. Geen kleur. Voedt de Industrie-dropdown
in het bedrijfsprofiel + de beheer-sectie (*Personalisatie → Industries*).
**Symptoom nu (bevestigd):** endpoint 404/leeg → de Company-dropdown toont de **frontend-noodlijst**
`DEFAULT_INDUSTRIES` (uit `lib/useIndustries.js`), maar *Personalisatie → Industries* (`StatusListEditor`,
géén fallback) staat **leeg** → ze lopen uiteen. **Fix:** endpoint bouwen **+ seeden** met die defaults
(Werving/Uitzendbureau/Horeca/Logistiek/Zorg/IT/Bouw/Onderwijs/Financiën/Overig) zodat dropdown én editor
**dezelfde bron** lezen en de beheersectie niet leeg is. Idem geldt voor `/functions` (C-14) + genders/talen.

### ☐ C-8 · `placements` → `matches` hernoemen  *(NIEUW)*
Frontend gebruikt nu `/candidates/{id}/matches` (POST/PATCH/DELETE), leest GET-detail
`matches: [...]` (met `placements` als tijdelijke fallback) en `stats.matches_count`.
Hernoem relatie/route/resource naar `matches`.

### ◐ C-9 · `GET /candidates/stats` veldnamen — niet meer blokkerend  *(NIEUW)*
Backend geeft `by_status` → `status`, `by_funnel` → `funnel_type`, `by_owner` → `owner_id`.
Frontend leest dit nu defensief (B-5), dus de charts werken weer. *Nice-to-have:* één
conventie kiezen (`value`/`id` óf de huidige descriptieve keys) en consistent doortrekken.

### ☐ C-10 · Status/funnel-model (lifecycle + sollicitaties)  *(NIEUW — bijgewerkt 2026-06-21)*
- Kandidaat-status = configureerbare lifecycle-lookup per tenant (**default: Lead → Kandidaat**;
  later evt. Inactief/Archief). Scheid lifecycle van beschikbaarheid (Beschikbaar/Ziek/Verlof als
  apart veld, pas na plaatsing relevant). **Prospect en Sollicitant zijn géén lifecycle-status.**
- **"Sollicitant" = afgeleid:** een Kandidaat met ≥1 lopende sollicitatie. De frontend onthult de
  funnel op basis van **`candidate.applications` (niet leeg)**, niet op een status-vlag → de eerder
  bedachte `is_applicant`-vlag is niet meer nodig (mag vervallen).
- Expose `candidate.applications`: `[{ id, vacancyTitle, stageLabel, stageColor }]` voor de read-only
  fase-chips. Eén kandidaat kan meerdere (en herhaalde) sollicitaties hebben; bewerkbare fase leeft op
  de sollicitatie zelf. Definieer gedrag bij ontkoppelen/afsluiten van een sollicitatie.

### ☐ C-11 · Kandidaat — kanaal-consent (opt-in)  *(NIEUW)*
Frontend toont nu 3 opt-in toggles (WhatsApp / e-mail / nieuwsbrief) in de Communicatie-tab,
opgeslagen via `PATCH /candidates/{id}` als `consent: { whatsapp_opt_in, email_opt_in,
newsletter_opt_in }` (bool). AVG: leg per toestemming ook **tijdstip + bron** vast
(wanneer/hoe gegeven) en lever die terug in GET-detail. Geen marketing-verzending zonder opt-in.

### ☐ C-12 · Recruiter-kleur in de owner-payload  *(NIEUW — klein)*
Update-endpoint + opslag bestaan al: `PUT/PATCH /users/{id}` accepteert `avatar_color`
(`UserController::update`, in `$fillable`) en `/users` geeft het terug → de kiezer (B-11)
werkt. **Alleen nog dit:**
- Voeg **`avatar_color`** toe aan de owner-payload van `/candidates`: in `attachOwners()`
  het `User::...->get([...])` uitbreiden met `'avatar_color'` (+ de owner-velden van de
  list/detail-resource), zodat het eigenaar-icoon in de kandidatentabel de kleur toont.
- Optioneel: seed recruiters met een kleur uit het zachte palet (anders fallback-kleur).

### ◐ In uitvoering / groot
- **WhatsApp WABA + WAHA (NOWEB) self-hosted gateway** — warm (WABA) + koud (gateway),
  aparte Docker-service, EN-uitleg in `.txt`, eigen map. Hosting-keuze open (zie A).
- **Jaicob tijdelijke kandidaat-sync** (`api.jaicob.ai/candidates/public`) — tijdelijk,
  aparte map, geen nieuwe tabellen, token encrypted. Status verifiëren.

### ◐ C-13 · Messaging-shapes + attention-tiles afronden  *(NIEUW)*
**Peiling 2026-06-21: `/settings/messaging-limits|costs|message-retention` zijn LIVE (401) ✅** —
resterend = shapes bevestigen tegen echte responses (zie B-12) + de attention/outreach-punten hieronder.
Frontend heeft de "ready"-endpoints aangesloten (messaging-settings + attention-tiles
`stale_6m`/`never_contacted` uit `stats.attention`). Nog nodig van backend:
- **Bevestig veldnamen**: `GET/PUT /settings/messaging-limits` (aangenomen `{ limit, ceiling, unit? }`;
  PUT `{ limit }`; blokkeer > ceiling) en `GET/PUT /settings/message-retention` +
  `/profile/message-retention` (aangenomen `{ days }`; effectief = laagste, ook server-side afdwingen).
  Verduidelijk `messaging-costs.usage` (scalar/object) + de `by_number`-rij (`{ number, messages?, cost }`);
  valuta = **EUR**. Meld als er meerdere limieten zijn (per dag/maand/nummer).
- **Twee attention-velden toevoegen** aan `stats.attention`: `no_followup_planned`
  (geen geplande follow-up/taak) en `active_conversation` (lopend WhatsApp/e-mail-gesprek),
  meetellend met de actieve filters. Zodra geleverd, zet ik de twee placeholder-tiles live.
- **Outreach-shape**: lever de shape van `GET /candidates/{id}/outreach` (7 dagen, kleuren
  uit de API), bv. `{ days:[{date,label,sent,delivered,read,replied,color}], totals:{...} }`,
  zodat ik het conversiewidget in de kandidaat-drawer kan bouwen (B-12).

### ☐ C-14 · `/functions` lookup + free-entry-toggle  *(NIEUW)*
Tenant-scoped CRUD-lookup zoals `/industries`. Velden: `id`, `name` (required), `position`.
GET → `{ data: [...], allow_free_entry: bool }` (of `allow_free_entry` op een tenant-setting).
Voedt het Functie-veld (creatable combobox) op kandidaat, voorkeuren en vacature.
`allow_free_entry=false` = strikte dropdown. Eén opgeslagen `function`-string (geen tweede veld).
**Strict-guard:** `allow_free_entry` van true→false mag alleen als álle bestaande functie-waarden
(kandidaten + vacatures) in de lijst staan. Lever een **preflight/dry-run** (bv.
`GET /functions/mismatches` → `[{ entity, id, name, function, count }]`, óf 409 bij de PUT met die
lijst) zodat de frontend de "te corrigeren"-werklijst kan tonen; pas de setting niet toe zolang er
mismatches zijn. Terug naar `true` mag altijd zonder check.

### ☐ C-15 · Kandidaat-bulk-mutaties — endpoints  *(NIEUW — blokkeert B-3)*
Frontend roept deze al aan (optimistisch + revert tot ze live zijn). Alles tenant-scoped
via de tenant-connectie (cross-tenant onmogelijk), Eloquent-bindings, batch `max:500` → 422,
idempotent, audit met **alleen ids** (geen PII). Kandidaten via UUID `id`. Standaard-response:
`200 { "updated": [uuid…], "skipped": [uuid…] }` (skipped = onbekend / andere tenant / al in
doeltoestand). Pool-endpoints zijn al klaar (zie D).
- `POST /candidates/bulk/owner` `{ candidate_ids, owner_id }` — perm `candidates.update`; valideer owner_id = user in deze tenant.
- `POST /candidates/bulk/funnel-stage` `{ candidate_ids, funnel_type }` — perm `candidates.update`; enum `prospect|intake|pool|alumni`.
- `POST /candidates/bulk/candidate-type` `{ candidate_ids, candidate_type }` — perm `candidates.update`; **REPLACE** `candidate_types` met `[candidate_type]`. ⚠️ bevestig replace vs append.
- `POST /candidates/bulk/tags/remove` `{ candidate_ids, tag }` — perm `candidates.update`; detach waar aanwezig.
- `POST /candidates/bulk/notes` `{ candidate_ids, text (required, max 2000) }` — perm `candidates.update`; zelfde notitie per kandidaat (author + timestamp).
- `POST /candidates/bulk/archive` `{ candidate_ids }` — **perm `candidates.delete`** (strenger; 403 zonder). SOFT-DELETE (`deleted_at`/`archived_at`), herstelbaar, audit. Response `{ archived, skipped }`. `GET /candidates` + `/candidates/stats` moeten gearchiveerden **standaard verbergen**; `?include_archived=1` om te tonen.
- `POST /candidates/bulk/restore` `{ candidate_ids }` — perm `candidates.delete`; un-archive. Response `{ restored, skipped }`.
Bevestig: routes, response-keys, replace-vs-append, en hoe gearchiveerde rijen uit de default-lijst blijven.

### ☐ C-16 · Audit log — meer dekking + per-entiteit endpoint  *(NIEUW)*
- Log méér events (tenant-scoped, geen PII in properties waar vermijdbaar): kandidaat
  create/update/delete + status/funnel-wijziging, vacature, sollicitatie/fase, documenten,
  consent/opt-in-wijzigingen. Frontend toont `log_name` al generiek.
- Lever subject-velden mee in `/activity-log` (`subject_type`, `subject_id`, evt. `ip`) zodat
  de frontend een entiteit/IP-kolom + entiteit-filter kan tonen (B-14).
- `GET /candidates/{id}/activity` → `[{ id, log_name, description, causer_name, causer_email,
  created_at, properties }]`, role-gated, voor de per-kandidaat changelog-tab (#10).

### ✅ C-17 · Endpoint-naamgeving opschonen — BACKEND KLAAR (2026-06-21)
Native Koios = schone namen (geen prefix); externe bronnen = bron-prefix (ShiftManager `sm_`,
HelloFlex `hf_`). Conventie vastgelegd in **CLAUDE.md §3** (tabellen én routes). **GEEN alias** —
clean break (Danny: "niks met crm"). Definitief geleverd + getest (suite 112/112):
- `/crm/candidates` (deprecated) + `CrmCandidateController` **verwijderd**.
- `/crm/customers` → **`/customers`** (+ `/customers/{id}/locations|departments|contacts`).
- `/sm/customers` → **`/sm_customers`** (+ `/sm_customers/{id}/contacts`, `/sm_customers/sync`).
- `/sm/candidates` → **`/sm_candidates`** (+ `/sm_candidates/sync`, `/whatsapp`).
- `/sm/reports/*` → **`/sm_reports/*`**. Alle deprecated `sm-candidates`/bare `/customers`-aliassen weg.
- HelloFlex `hf_` = toekomst (nog geen endpoints).
→ **B-15 kan nu om** (geen fallback meer; `/crm/*` en `/sm/*` geven 404).

---

## E. Backlog uit brain-dump (2026-06-21) — per domein

> Ruwe ideeën van Danny, opgesplitst: **[FE]** frontend · **[BE]** backend · **[D]** jouw beslissing.
> Status: ☐ open · ◐ deels · ✅ klaar · ❓ onduidelijk. Genomen keuzes staan in **✅ Beslissingen** onderaan deze sectie.
> Wat al in A/B/C/D staat wordt ge-cross-refd, niet herhaald. De codes tussen haakjes
> verwijzen naar Danny's eigen nummering in de brain-dump.

### E1 · Kandidaten — FOCUS (prioriteit)

**Tabel & overzicht**
- ✅ [FE] Zacht kleurenpalet (geen "disco"). *(K2)*
- ◐ [FE] Tabel + overzicht opruimen, meer rust — rust-redesign grotendeels klaar; restpoetsen. *(K5)*
- ☐ [FE] Inline-edit als klein blokje + **auto-opslaan** overal (nu potlood/diskette). *(K1)*
- ☐ [FE] Tabel-**sortering** per kolom + kolomvolgorde instelbaar. *(F1, F4)*
- ☐ [FE] Tabjes nalopen + **volgorde** vastleggen. *(F6, F19)*
- ☐ [FE] Filters nalopen (compleetheid + gedrag). *(F7)*
- ☐ [FE] "Gewijzigd op" tonen in tabel/drawer. *(F15)*
- ☐ [FE+BE] "Laatste contact-**type**" (kanaal) tonen. *(F16, I23)*
- ☐ [FE] Spacing "Koios Adviseer"-blok herzien. *(F17)*
- ☐ [FE+BE] AI-advies → "voorgestelde actie" op de kandidaat. *(F8 — hangt op B-2)*

**Bulk-acties** *(zie B-3)*
- ✅ [FE] Eigenaar wijzigen · pool toevoegen/verwijderen · funnel-fase · kandidaat-type · **tag verwijderen** · **notitie toevoegen**. FE klaar; backend = C-15. *(K6.1, K6.3)*
- ✅ [FE] Checkboxes + "Massa mutaties"-menu (drill-in, herbruikbare `ActionMenu`). *(F2)*
- ☐ [FE+BE] **Tag toevoegen** (bulk) — creatable (kiezen óf nieuw typen, besloten). Tag *verwijderen* is wél klaar. *(K6.2)*
- ◐ [FE] **Status soft-delete/archiveren** — FE klaar (rode actie + `window.confirm` + autorisatie-gate); backend moet soft-delete + standaard verbergen in lijst leveren (C-15). *(K6.4, I18)*
- ☐ [FE+BE] **Koppelen aan vacature** (bulk) → maakt sollicitatie. **Besloten: geen gevolg-e-mail.** (fase 2) *(K6.5)*
- ◐ [FE+BE] **Autorisatie** op bulk-acties — archiveren UI-gated via `hasPermission`; backend moet per-rol enforced (C-15). *(F2)*

**Velden & sub-entiteiten**
- ☐ [FE] Ervaring-einddatum: checkbox **"heden"**. *(F23)*
- ☐ [FE] Opleiding-einddatum: checkbox **"nog bezig"**. *(F24)*
- ☐ [FE] Certificering-einddatum: checkbox **"onbeperkt"**. *(F25)*
- ☐ [FE] Talen + gespreksniveau + schriftelijk niveau als **dropdowns** (lookups bestaan al). *(F20)*
- ☐ [FE] Documenten **hernoemen**: alleen het deel vóór de bestandsextensie bewerkbaar. *(F21, zie C-3)*
- ☐ [FE+BE] Alle velden/tabjes nalopen: alles in tabellen + API erachter. *(F10)*
- ☐ [FE+BE] **Vestiging** koppelen met gebruikers-autorisaties. *(F22 = C-4)*
- ☐ [BE+FE] **Geo = OpenStreetMap** (besloten): eigen API/koppeling + kaartje op een kandidaat-tabje;
  **rate-limit + caching** + "high-performance"-melding bij zware radius-zoek → advies talentenpool. *(F11, I16)*

**Voorkeuren-tab** *(nu enkel tekstvelden in `PreferencesZzpTabs` — herzien)*
- ☐ [FE] Voorkeursdagen: **meerdere** kiesbaar (nu één tekstveld). *(F26.9.1)*
- ☐ [FE] Diensttype toevoegen + uit "planning" halen. *(F26.9.2)*
- ☐ [FE] Rijbewijzen: **meerdere** (zoals pools) i.p.v. één checkbox. *(F26.9.3)*
- ☐ [FE] "Voorkeursfunctie" verwijderen (dubbel met functie). ❓ *(F26.9.4)*
- ☐ [FE] Contactvoorkeur als **dropdown** (telefonisch / WhatsApp / e-mail). *(F26.9.5)*
- ☐ [FE] Voorkeursbranche behouden. *(F26.9.7)*
- ◐ [FE] ZZP-tab nalopen/updaten (schema bestaat al). *(F26.10)*

**Plaatsing / Match-flow (groot)** *(F26 — hangt op Matches + C-2/C-8)*
- ☐ [FE+BE] Klant zoeken (type→klant), dan **locatie/afdeling/contactpersoon** koppelen. *(F26.1–3)*
- ☐ [FE+BE] **Kostenplaats**: voorstel uit stamdata, aanpasbaar. *(F26.4)*
- ☐ [BE] **Schaal + trede** uit backend; CAO bij de klant kiezen. *(F26.5)*
- ☐ [FE] Vinkje **"afwijken tarief"** (override schaal/trede) + verplicht reden-veld. *(F26.5.1–2)*
- ☐ [BE] **Contractsoort** dropdown uit backend (ABU/NBBU fase A/B/C of 1-2-3, MUB/ZUB; ABU/NBBU op het bedrijf). *(F26.5.3)*
- ☐ [FE] Opmerkingen-veld (voorstel RC / voorstel AM). *(F26.6)*
- ☐ [FE+BE] Knop **"versturen naar backoffice"** (HelloFlex): volledige logging, max 1×/5 min bij identieke payload (anti-duplicaat), start workflow. *(F26.7)*
- ☐ [FE+BE] **Planning → inplanning mailen**: e-mail kandidaat overnemen, ingeplande diensten in body, open diensten via AI; pools/functie/skills instelbaar in instellingen. *(F26.8)*
- ☐ [FE] Communicatie: **versturen** via WhatsApp of e-mail vanuit de drawer. *(F26.11)*

**KPI's** *(grotendeels ✅ — `CandidatesInsightsRow`)*
- ✅ [FE] Status-/funnel-/RC-donuts; "niet benaderd >6 mnd"; "nooit benaderd"; "geen opvolging"; "intake"; "actieve gesprekken". *(F3, KPI-blok)*
- ◐ [FE+BE] Actieve gesprekken **per kanaal** (WhatsApp Business / Web / e-mail) — nu placeholder "–". *(F3.3)*
- ☐ [FE+BE] **Intake-agenda**: wanneer intake gepland, agenda-overzicht + aantallen per RC; status gelinkt aan afspraak. *(F3.6)*

**Status-model, changelog, consent**
- ✅ [D] **Besloten: hybride** — recruiter zet status meestal zelf, acties zetten 'm automatisch. *(K8 — zie A)*
- ☐ [FE+BE] Configureerbare kandidaat-statussen in instellingen. *(F13 = C-10)*
- ✅ [D] **Besloten: status = Lead → Kandidaat** (Prospect weg); "Sollicitant" is geen status maar afgeleid uit lopende sollicitaties. *(F14 → C-10)*
- ☐ [FE+BE] **Changelog op de kandidaat** (tabje of icon). *(K7, F12)*
- ✅ [FE+BE] Opt-in WhatsApp/e-mail/nieuwsbrief op profiel. *(F5 = C-11)*
- ☐ [BE] **Fix**: agenda-fouten bij planning. *(F18 — bug)*

### E2 · Vacatures *(grotendeels nieuw)*
- ☐ [FE] Vacatureweergave **zoals Jaicob (JC)** — concurrent-ATS als referentie. *(V1)*
- ☐ [FE+BE] KPI's op de vacature. *(V2)*
- ☐ [FE+BE] "KOIOS actie" (AI-actie op vacature). *(V3 — hangt op B-2)*
- ☐ [FE+BE] Intake gepland per week/maand; **status gelinkt aan afspraak**. *(V4)*
- ☐ [FE+BE] Aantal online · aantal kandidaten. *(V5, V6)*
- ☐ [FE+BE] Afgewezen-kandidaten **rapport** (per kostenplaats/week/maand/functie/vacature/bron). *(V7)*

### E3 · Taken *(besloten — zie Beslissing 8)*
- ☐ [FE+BE] **Takenbord (Kanban) in onze huisstijl** — kolommen TeDoen / In behandeling / Afgerond
  (drag & drop). Activiteitkaart: type, titel, omschrijving, **toewijzen aan** (gebruiker óf bureau),
  status, **einddatum**, **prioriteit**, **reacties**; koppelen aan **kandidaat / opdrachtgever /
  contactpersoon** + eigenaar; zoeken/filter + AI ("Vraag Nova"). *(T1)*

### E4 · Klanten
- ☐ [FE+BE] Hoofdklant · locaties · afdelingen · contactpersonen (hiërarchie). *(KL1–4, zie C-6)*
- ☐ [FE] Bekijken/koppelen **ShiftManager (SM)** + **HelloFlex**. *(KL5)*
- ☐ [FE] Tabs zoals bij kandidaten ook bij klanten/vacatures/taken/matches. *(N15)*
- ☐ [FE+BE] **Besloten:** locaties/afdelingen/contactpersonen **uit de sidebar**, onder de klant nesten
  met (sub)tabs — wél veel méér informatie per onderdeel. *(N16, KL2–4)*

### E5 · Matches *(besloten — zie Beslissing 3)*
- ☐ [FE+BE] **Match = vervolg ván de sollicitatie**: bij een bepaalde sollicitatie-fase door naar Matches
  → **plaatsing** (+ evt. contract ABU/NBBU). *(M1, M1.2)*
- ☐ [FE+BE] Knop op de kandidaat **"Koppelen met HelloFlex / Backoffice"**; handmatig (admin) + via
  **workflow/AI-agents** automatisch instelbaar. *(M1.2, I7/I8)*
- ☐ [FE+BE] Match-velden: standaardset + meer instelbaar; klant kan zelf kiezen. *(M1.1)*
- ☐ [BE] **Match-scoring-engine** (Danny's CONFIG): urgentie/functie-match/favoriet/voorkeur/weekend/duur
  + klant-bonus/malus per `customer_id`; geen functie-match = uitfilteren. *(referentie-script)*
- ✅ [FE] Terminologie placements → **Matches** (UI). *(I6 = C-8 backend)*

### E6 · Instellingen & Profiel
- ☐ [FE] WhatsApp privé + zakelijk: **verbroken-status** tonen. *(I1 — hangt op B-7/B-1)*
- ✅ [FE] Geen planning-module → planning verborgen bij kandidaat (verifiëren). *(I2, N14)*
- ☐ [FE+BE] Changelog in instellingen **splitsen op type**. *(I3)*
- ☐ [FE+BE] **Vertalingen** voor klant-aangemaakte types (lookups). *(I4)*
- ☐ [FE+BE] Rapporten onder module Planning. *(I5)*
- ☐ [FE] Instellingen-tab **Planning** met subtabs. *(I10)*
- ☐ [FE+BE] In/uit-planning **mails** voor planning-events + vinkje contactpersoon. *(I11)*
- ☐ [FE+BE] Workflows verbeteren + builder-logs/runtime/max-runs/logbestanden. *(I13, N11)*
- ☐ [FE] "Apps" bij instellingen nalopen. *(I14)*
- ☐ [FE] Tekst-editor **expand/verkleinen** (groter/kleiner maken), zoals de Make/JS-editor. *(I12)*
- ☐ [FE+BE] **Soft + hard delete** overal; hard delete alleen als er geen objecten hangen (ook API-check); anders "overzetten"-melding → bulk-acties. *(I18–20)*
- ☐ [FE+BE] Module **Rapporten**: conversieratio per RC-campagne en source. *(I21)*
- ☐ [BE] Koppelingen **Indeed / Werkspot / Werkzoeken** etc. *(I22, N17)*
- ☐ [BE] Nachtelijke Koios-AI-job: gewijzigde kandidaten + nieuwe pool bijwerken → "gewijzigd op". *(I25)*
- ☐ [D+BE] **Pricing** per module (ATS/CRM/WhatsApp privé+zakelijk/rapporten/workflows). *(I26)*
- ☐ [FE] "Coöperate": match-plaatsen + HelloFlex/backoffice-koppeling overal duidelijker. ❓ *(I7, I8)*
- ☐ [BE] Solliciteer-tab: afgewezenen **bewaren**. *(I17)*

### E7 · API & Webhooks *(zie C-5)*
- ☐ [BE] Webhook-events + filtering. *(A2 = C-5b; FE = B-6)*
- ☐ [BE] API-gebruikers zoals HelloFlex. *(A3 = C-5a)*
- ☐ [BE] **Log** alle verstuurde webhook-events + álle API-calls. *(A4, N6)*
- ☐ [FE] Instellingen ↔ API-koppeling consistent. *(A1)*
- ☐ [BE] External API: **input-validatie** op klant-data (model/policy/controller/migration + e-mail/tel). *(N12)*

### E8 · Koios AI *(zie B-2)*
- ☐ [BE] AI-prompts via Claude-API inregelen. *(AI1)*
- ☐ [FE+BE] Instelbaar wat Koios AI wel/niet mag (bij instellingen). *(AI2 = B-2)*
- ☐ [BE] **Autorisatie**-guards (mag organisatie niet / mag persoonlijk niet). *(AI3)*
- ☐ [BE+FE] Alle verzoeken loggen per type + **dashboard** voor Danny. *(AI4)*
- ☐ [FE+BE] **Verbruik/kosten** + forecasting: tokens per gebruiker/type + WhatsApp-privé serverbelasting. *(AI5, AI6)*

### E9 · WhatsApp *(zie B-7 + C in-progress gateway)*
- ☐ [FE+BE] WhatsApp Business + privé afmaken. *(W1)*
- ☐ [FE+BE] WhatsApp-privé **queue** inzichtelijk (onder workflow?). *(W2)*

### E10 · Frontend-kwaliteit / audit *(doorlopend — gebruik `/audit`)*
- ☐ [FE] Leak-audit · geen bestand >1000 regels · modulair met 1 EN-comment/blok · geen console-fouten. *(FC1–5, §0/§12)*
- ☐ [process] Code-review + app-review (Gemini/Claude front+back; modules niet hackbaar). *(I15, I24, N1, N2)*
- ☐ [FE+BE] **MFA**. *(N8)*

### E11 · Server & Ops *(grotendeels Danny/infra)*
- ☐ [D] Dev + acceptatie + productie servers; push-flow dev→prd. *(S1, N5)*
- ☐ [D+FE] Server-status-overzicht (waarom down + herstart-knop) voor Danny. *(S2)*
- ☐ [D+BE] Verbruik + modules **per klant** → automatische facturatie. *(S3)*
- ☐ [D] Office 365 alias `KoiosMatch`. *(S4)*
- ☐ [D] Support + ticketsysteem. *(S5, N10)*
- ☐ [D] Backup-strategie. *(N4)*
- ☐ [BE+D] DoS/hack-bescherming · load balancer. *(N7, N9)*
- ☐ [BE] Seeder voor kandidaten. *(N13)*

### ✅ Beslissingen (2026-06-21)

**1+2. Status & funnel — twee losse assen.** **Status (de persoon) = Lead → Kandidaat** (Prospect
geschrapt; later evt. Inactief/Archief), **hybride** gestuurd (recruiter zet meestal zelf, acties
kunnen 'm zetten). **Funnel-fase = per sollicitatie** (Gesolliciteerd → Uitgenodigd → Voorstel →
Aangenomen/Afgewezen). **"Sollicitant" is géén status** — afgeleid: een Kandidaat met ≥1 lopende
sollicitatie (kan meerdere tegelijk + opnieuw). Funnel toont zich zodra er een sollicitatie is, niet
op een status-vlag (`is_applicant` vervalt). *(K8, F14 → C-10)*

**3. Matches = vervolg ván de sollicitatie.** Zodra een sollicitatie een bepaalde fase bereikt, gaat het
door naar **Matches** → wordt een **plaatsing** (+ evt. contract: ABU/NBBU) → **koppelen met backoffice
(HelloFlex)**. Knop op de kandidaat **"Koppelen met HelloFlex / Backoffice"**; admins pushen handmatig,
maar via **workflow / AI-agents** automatisch instelbaar (wanneer). *(M1, M1.2)*

**4. Klanten = onder de klant nesten.** Locaties/afdelingen/contactpersonen **uit de sidebar**; binnen de
klant tonen met (sub)tabs — maar dan wél met véél meer informatie per onderdeel. *(N16, KL2–4)*

**5. Koppelen aan vacature → e-mail via workflow.** Niet hard ingebouwd: via de **workflow-builder of
settings** stuur je de kandidaat een bevestigings-e-mail **met Google Meet-link**. Bij *bulk*-koppelen
bewust géén auto-e-mail. API moet `vacancy/match` ondersteunen. *(K6.5)*

**6. Geo = OpenStreetMap** (gratis/EU, AVG-vriendelijk). Er moet een **eigen API/koppeling** voor gebouwd;
een **kaartje** kan op een tabje bij de kandidaat. ⚠️ **Performance/kosten:** reistijd/afstand elke filter
opnieuw berekenen wordt zwaar → **rate-limit + caching**, en bij zware zoekopdrachten (ook via Koios AI,
bv. "Verzorgende IG in Zuid-Holland binnen 30 km van Den Haag") een nette melding *"high-performance
zoekopdracht — let op de kosten"* + advies **"maak/voeg toe aan een talentenpool"** zodat je daarna alleen
die pool selecteert. *(F11, I16)*

**7. JC = Jaicob** (concurrent-ATS) → vacatureweergave zoals zij. **JS** = niet Make, maar de
**expand/verklein-knop van de tekst-editor** (groter/kleiner maken). *(V1, I12)*

**8. Taken = Kanban "Takenbord" in onze huisstijl.** Kolommen **TeDoen / In behandeling / Afgerond**
(drag & drop). Activiteitkaart: type, titel, omschrijving, **toewijzen aan** (gebruiker óf bureau), status,
**einddatum**, **prioriteit**, **reacties**; koppelen aan **kandidaat / opdrachtgever / contactpersoon**
+ eigenaar; zoeken/filter + AI ("Vraag Nova"). *(T1)*

> **Matching-engine (referentie-script).** Danny's CONFIG scoort shifts per kandidaat: `TOP_TOTAAL`,
> `MIN_DUUR`, punten voor **urgentie** (WEEK_1–4), **functie-match** (primary/secondary/geen → -1000 =
> uitfilteren), **favoriet/klant** (bonus/malus per `customer_id`), **diensttype-voorkeur**, **weekend**,
> **duur**. Kern van Matches / Koios AI-matching — bewaren als basis voor de backend-scoring.

---

## D. ✅ Afgerond (archief — niet meer doen)

**Backend**
- Pools — 9 endpoints + seeder; kleuren via API.
- Soft colors — recolor-migratie naar zacht palet.
- Kandidaat-detail migraties — `experiences.current`, `educations.{school,end_date,in_progress,description}`, `users.avatar_color`, lookup-tabellen `genders/languages/language_levels`.
- 18 sub-entiteit-routes + lookup-routes (genders/languages/language-levels).
- Vacancy-routes bestaan (404/500 → 401); in_use-vlag + 409 op alle lookups; demo-seed (`lookups:seed-demo`).
- E-mail per context (klanten/kandidaten/planning + default) — backend klaar (frontend = B-1).
- Koios AI backend-API — af (frontend = B-2).
- Tenant modules & packages (16 package-IDs), `tenant:create`, demo/Yesway-seeders.

**Frontend**
- Rebrand koiosconnect → koiosmatch; login-redesign; sidebar/modules; ShiftManager-rapportage.
- Settings-herbouw (modulair, tabjes); per-module gating; zacht palet; potlood/diskette-edit.
- Talen/Niveaus/Geslacht + Industrie-lookups; locatie-formulier volwaardig; placements→matches (UI/code).
- Bulk pool add/remove (optimistisch); rust-redesign kandidaat-drawer (funnel uit header).
