# Koios Match — Werklijst

> **Eén levende bron.** Alleen open taken. Specs staan in CLAUDE.md §3B of in een C-item hieronder.
> **Bijgewerkt:** 2026-06-24
>
> **Legenda:** ☐ open · ◐ deels klaar · ✅ klaar · 🔴 blokkerend · [D] Danny · [FE] Frontend · [BE] Backend

---

## A. Danny — beslissingen nodig

- [ ] **A-1** [D] Kandidaat drawer hertekenen (plan klaar, sessie 2026-06-24): 6 tabs + subtabs. Goedkeuren?
- [ ] **A-2** [D] "Kans" = sales-deal (lezing a, huidig) of open vacature/positie (lezing b)? Bepaalt het datamodel.
- [ ] **A-3** [D] Handmatig status `matched` zetten → prompt om Match te koppelen? Of gewoon toestaan + inconsistentie-vlag?
- [ ] **A-4** [D] Hosting WhatsApp-gateway: Hetzner (EU, goedkoop) vs. strikt NL (premium)?
- [ ] **A-5** [D] Terminologie definitief: "vacancy" of "vacature"? Consistent doorvoeren.
- [ ] **A-6** [D] Adres bij locaties: huidige compacte weergave ok, of anders?
- [ ] **A-7** [D] Module Taken verplicht voor auto-taken in workflows? (lijkt ja)
- [ ] **A-8** [D] Waar leeft de "weer-beschikbaar-actie": workflow of settings?
- [ ] **A-9** [D] Welke kanalen default voor afwijzing/benadering (e-mail / WA Business / WA privé)?

---

## B. Frontend — open taken

### 🔴 B-A1 · Kandidaat drawer hertekenen (nieuw plan 2026-06-24)
Volledig nieuwe tabstructuur. **Wacht op A-1 (Danny akkoord).**

**6 hoofdtabs + subtabs:**
1. **Profiel** — subtabs: Persoon · Contact · Achtergrond · Profieltekst
2. **Werk & Planning** — subtabs: Inzetbaarheid · Voorkeuren · Sollicitaties · Matches
3. **Communicatie** — subtabs: Berichten (Email + WA Business + WA Privé, één stroom) · Notities · Opt-ins
4. **Documenten** — plat, geen subtabs
5. **Koios AI** — advies + signalen + statistieken
6. **Tijdlijn** — read-only feed (statuswijzigingen + alle contact-events)

`last_contact_at` + `last_contact_type` automatisch bijgewerkt bij elk bericht.

### B-A1.1 · Kandidaat drawer — subtab Persoon
Bevat: naam, geslacht, geboortedatum, geboorteplaats, nationaliteit, profielfoto.

### B-1 · E-mail per context
Settings-UI: 4 panelen/tabs, provider-keuze, handtekening-editor, default-fallback. Backend klaar.

### B-2 · Koios AI — verbruik + super admin
- Scherm C: verbruik per gebruiker/type (`GET /ai/koios/usage`)
- Scherm D: super-admin overzicht (`/admin/usage` + `/admin/prompts`)
- Paperclip/upload in de chat
- Hangt op: backend veldnamen bevestigen

### B-3 · Bulk-acties fase 2
- Tag toevoegen (creatable, nu alleen verwijderen werkt)
- Koppelen aan vacature (bulk → maakt sollicitatie, geen auto-e-mail)
- Vestiging/branch koppelen
- Hangt op: C-15 (array-uitbreiding)

### B-6 · Webhooks filter-UI
Live testen zodra `/webhook-subscriptions` + `/webhook-events` bestaan (C-5b).

### B-7 · WhatsApp Web (persoonlijk) — live verifiëren
Frontend gebouwd; endpoints wachten op gateway.

### B-8 · Sollicitatie-tab op de kandidaat
Match-score + AI-afwijsreden + bewerkbare funnel-fase per sollicitatie.
Hangt op: B-2, C-23 (applicaties detailshape).

### B-9 · Profiel — gekoppelde rollen + persoonlijke e-mail
Rollen tonen + Gmail/O365/SMTP koppeling.

### B-10 · Status/funnel-model doortrekken (frontend)
- `is_applicant`-gating opruimen
- `status==='intake'` vervangen door afspraken-KPI
- Hangt op: C-10

### B-12 · Messaging-schermen afronden
Shapes verifiëren + outreach-conversiewidget bouwen.
Hangt op: C-13 (shapes + outreach-endpoint)

### B-13 · Functie-toggle uitrollen
Toggle dropdown↔vrij + strict-guard werklijst in Settings → Personalisatie → Functies.
Hangt op: C-14 (klaar, maar toggle-UI nog te bouwen)

### B-14 · Audit log uitbreiden
Entiteit/IP-kolom + entiteit-filter + per-kandidaat changelog live.
Hangt op: C-16

### B-17 · Afspraken/Intakes
- Afspraken-sectie/tab op de kandidaat
- Inconsistentie-signaal (fase vereist afspraak, maar geen geplande)
- Intake-rapport + agenda-overzicht
- Hangt op: C-22

### B-18 · Sollicitaties — drawer tabs + AI-beoordeling + afwijzing
6 tabs vullen + MatchScoreBlock + RejectionBlock + beoordelingscriteria-settings.
Hangt op: C-23/C-24/C-25

### B-19 · Vacatures — feature-refactor naar candidate-blueprint
Monoliet VacanciesPage.jsx herbouwen. Hangt op: C-26

### B-20 · Taken — feature naar candidate-blueprint
Kanban + drawer + settings-lookups. Hangt op: C-18

### B-21 · Aangepaste velden — generiek over 8 entiteiten
CustomFieldsEditor + CustomFieldsTab per entiteit. Hangt op: C-29

### B-22 · Dashboard de-hardcoden
Alle hardcoded arrays vervangen door live API-calls. Hangt op: C-30 + C-26 + C-18

### B-23 · Dashboard visueel herontwerp
Charts, hero-tijdreeks, funnel, donuts. Hangt op: B-22 + C-31

### B-26 · Pakket-/module-herstructurering ◐
FE-stappen 1–6 klaar. Open: `GET /admin/usage` (alle-klanten-overzicht).
Hangt op: C-32

### B-27 · Rol-gebaseerd operationeel dashboard
7 templates, `useDashboardLayout()`, blokken als losse componenten.
Hangt op: C-34 + C-35

### B-28 · Rapporten-hub (analytisch)
5 sub-tabs, per-tab autorisatie. MVP = Kandidaten/instroom-uitstroom tab.
Hangt op: C-34

### B-29 · RolesSettings — dashboard-template picker + preview
Template-picker + live miniatuur mockup in rol-detail.
Hangt op: C-35

---

## C. Backend — open taken

### 🔴 C-0 · Volledige seeder (Yesway + demo)
Alle lookups + realistische sample-data voor beide tenants. Geen lege schermen meer.

### 🔴 C-10 · Status/funnel-model reseed
Status herseed naar: `lead · candidate · matched · inactive · unplaceable`.
Blacklist = aparte vlag. Archived = soft-delete.
Details + afstemming: zie originele spec in git-history.

### C-1 · Lookups — "in gebruik"-vlag + 409 ◐
Verifiëren met ingelogde sessie: vacancy status/fase toevoegen + reorder werkt.

### C-2 · Kandidaat sub-entiteiten — body-contracten
Sub-entiteit CRUD (experiences/educations/certifications/skills/matches/languages/preferences/zzp).

### C-4 · Kandidaat — Branches koppelen
`POST /candidates/{id}/branches { customer_id }` + DELETE + GET-detail `branches: [{ id, name }]`.

### C-5b · Uitgaande webhooks
`/webhook-subscriptions` + `/webhook-events` (404 → nog te bouwen).

### C-6 · Locaties — gestructureerde velden
Volledige velden op `POST/GET /locations` (straat/huisnr/postcode/etc.).

### C-7 · `/industries` lookup
CRUD-lookup geseed met defaults. Fix: dropdown en beheersectie lezen dezelfde bron.

### C-8 · `placements` → `matches` hernoemen
Relatie/route/resource hernoemen.

### C-11 · Kandidaat — kanaal-consent (opt-in)
`PATCH /candidates/{id}` met `consent: { whatsapp_opt_in, email_opt_in, newsletter_opt_in }` + tijdstip/bron bewaren.

### C-13 · Messaging-shapes + attention-tiles
Shapes bevestigen + `no_followup_planned` + `active_conversation` + outreach-shape leveren.

### C-15 · Bulk-mutaties — array-uitbreiding
`POST /candidates/bulk/candidate-type` moet `candidate_types: []` (array, REPLACE) accepteren.

### C-16 · Audit log — meer dekking
Subject-velden mee in `/activity-log` + `GET /candidates/{id}/activity`.

### C-18 · Taken — tabellen + endpoints + seeder
Volledige taken-feature (kanban, lookups, comments, seeder).

### C-19 · Matches — tabel + endpoint + seeder
`/matches` als eigen tabel of view over applications? Bevestigen.

### C-20 · Applications — seeder + `match_score`
Seeder ~10 sollicitaties + `match_score` kolom.

### C-21 · Kandidaten-velden + lookups + soft-delete
`/last-contact-types` + `/note-types` + seeder last-contact-at/-type + `place_of_birth` + `facebook_lead_id` + individuele soft-delete met preflight.

### C-22 · Afspraken/Intakes
`requires_appointment`-vlag + `appointments`-entiteit + `GET /reports/intakes`.

### C-23 · Alle kandidaat-velden leveren
API levert alle velden uit `mapCandidate.js`. Seeder vult ze realistisch.

### C-26 · Vacatures — tabel + endpoints + bulk + seeder
30 dummy-vacatures, lookups, bulk, koppeling sollicitaties.

### C-27 · Klanten — endpoints + sub-entiteiten + seeder
Volledige CRUD + locaties/afdelingen/contactpersonen + 15–20 klanten geseed.

### C-29 · Aangepaste velden — 8 entiteiten
Definitie-endpoints + `custom_fields` JSON per entiteit.

### C-30 · `GET /dashboard` summary-endpoint
KPIs + recents + filterbronnen in één call.

### C-31 · Dashboard charts-data
Tijdreeksen + verdelingen + funnel voor grafieken.

### C-32a · Afwijzing via workflow — event-trigger + queue
`application.rejected` event + workflow-trigger + multi-kanaal-bericht + tokens.

### C-32b · Pakket-/module-model
3 pakketten + add-ons + `GET /admin/tenants/{id}/usage`.

### C-33 · `ui_preferences` op users
JSON-kolom + `GET /auth/me` levert hem + `PATCH /users/{id}` accepteert hem.

### C-34 · Dashboard + Rapporten endpoints
`GET /dashboard` + `GET /reports/flow|recruiters|intakes|vacancies|matches`.

### C-35 · `dashboard_type` op rollen
Kolom + seed 7 standaard-rollen + `GET /auth/me` geeft `roles[].dashboard_type`.

### C-27-workflow · Workflow-modules — graaf-opslag
Steps opslaan met `position` + `connections[]` (target + filters). Stabiele step-ids.

---

## D. Afgerond (archief)

- Kandidaat-blueprint (CandidatesPage/Table/BulkBar/Drawer + rust-redesign)
- Status/funnel-model bevestigd (beslissing 14+16)
- Match-model (3 lagen: score/match/contract) — beslissing + FE gebouwd
- Bulk-acties fase 1 (eigenaar/pool/funnel/type/tag-verwijderen/notitie/archiveren)
- Recruiter-kleur (B-11/C-12)
- Sticky header + default sort op Toegevoegd (DataTable)
- Horizontaal scrollbare tabel + sticky naamkolom
- Endpoint-rename (C-17 + B-15): `/crm/*` → schone namen, `/sm/*` → `sm_`-prefix
- API-keys + scopes (B-4/C-5a)
- Settings-herstructurering (eigen menu's per domein + sub-tabs)
- Opportunties shell (C-28 klaar)
- Pakket-model FE stappen 1–6 (B-26 deels)
- Dashboard: klik past filter toe (B-24), instroom-chart (B-25)
- Klanten herbouwd naar candidate-blueprint (E4)
- WhatsApp Business + persoonlijk (FE gebouwd, wacht gateway)
- Koios AI chat + settings (B-2 deels)
- Documenten-upload (C-3)
- Functions lookup (C-14)
