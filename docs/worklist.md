# Koios Match — Werklijst (Danny · Frontend · Backend)

> **Eén levende bron** voor alle openstaande taken. Claude werkt dit bij elke sessie bij.
> Dit vervangt alle losse `backend-prompt-*.md` / `backend-worklist.md` bestanden.
>
> **Laatst bijgewerkt:** 2026-06-21 (sessie 4) · door frontend-Claude — **GEBOUWD (B-16):** skills-lijst +
> status/eigenaar compacter + datum **DD-MM-YYYY** + geboorteplaats + profieltekst clear/vergroten (B-16.4);
> **bulk type → multi-select** add/remove (nieuwe `ActionMenu`-node + regressietest, backend C-15 moet array
> accepteren) (B-16.6); **Taken-KPI** uit `stats.attention.tasks` (B-16.5). Ook — **PLAN goedgekeurd: Vacatures-refactor**
> (candidate-blueprint) → nieuw **B-19** (frontend) + **C-26** (backend: vacancies-tabel/endpoints/bulk/lookups +
> seeder met 30 vacatures en gekoppelde sollicitaties; géén frontend-dummy). Eerder (sessie 3) — **GEBOUWD:** B-16.1 (settings →
> eigen menu's *Kandidaatlijsten/Talen/Vacatures* met sub-tabjes, i18n ×5) + B-17.1 (funnelfase-toggle
> `requires_appointment`); **AddCandidateModal** omgebouwd (nieuwe kandidaat = status Lead, geen funnel) +
> **CandidatesPage** dummies/predicaten/intake-KPI op het nieuwe model. Beslissingen **14 + 15** vastgelegd
> (15 = status/beschikbaarheid-wissel met datum+reden, "inactief sinds"). Eerder deze sessie — **Status/funnel-model bevestigd
> (beslissing 14):** seed Lead·Kandidaat·Geplaatst·Inactief, funnel op de sollicitatie (Gesolliciteerd→…→
> Afgewezen), `prospect/intake/pool/alumni` opgeheven; FE-seed-fallback rechtgezet (`LookupsContext.jsx`) +
> CLAUDE.md §3B (C-10/B-10 aangescherpt). **Sollicitaties (applications):**
> feature-refactor gestart (kandidaat-blueprint, mock-fallback) → nieuw item **B-18** (frontend). Het
> **backend-contract** (applications-detailshape + reject · beoordelingscriteria template+override ·
> afwijzing-instellingen) is als **losse prompt rechtstreeks aan backend-Claude** gegeven (2026-06-21),
> bewust **niet** in deze worklist opgenomen.
> **Sessie 2** · kandidaten-focus: CLAUDE.md §3B (Candidates working spec) + 5 beslissingen (9–13);
> geconsolideerd in **B-16/B-17** (frontend) en **C-21/C-22** (backend).
> **C-22 = afspraken/intakes + funnelfase-`requires_appointment`-vlag + intake-rapportage** (afdwingbaar → rapporteerbaar).
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

- [x] **Besloten — Match-model (3 lagen, 2026-06-21).** Drie aparte begrippen, drie namen:
  1. **Match score** = de fit (0-100 % + criteria) in het sollicitatieproces → eigenschap van de
     **sollicitatie** (`applications.match_score` + `match_criteria` + `match_summary`, plat — géén `match`-object).
  2. **Match** = sollicitatie haalt het einddoel (aangenomen). Onze eigen entiteit (`matches`-tabel, `GET /matches`).
     **1 vacature : N matches** (vacature blijft open of sluit handmatig). **Trigger:** auto bij de eindfase, waarbij
     "eindfase" een **configureerbare vlag op de funnel-fase** is (mirror `requires_appointment`), niet een hardcoded slug.
  3. **Contract** = duur + schaal/trede/uurtarief/contractsoort → **leeft volledig in HelloFlex** (backoffice)
     via een **API-call**. Wij bewaren **alléén de GUID + status** op de match (`helloflex_contract_guid`,
     `contract_status`). **Geen eigen contract-/placements-tabel.**
  → **Superseed:** (a) "matches = afgeleide view over applications" én (b) C-8 "placements → matches". De oude
  `placements` / `/candidates/{id}/matches` contract-sub-entiteit **vervalt**. Het backend-contract hiervoor is
  als **losse prompt** aan backend-Claude gegeven (2026-06-21). **Frontend-gevolg — ✅ KLAAR (2026-06-22):**
  applications-drawer leest `match_score`/`match_criteria`; **`MatchesTab` is nu READ-ONLY** (geen
  `/candidates/{id}/matches`-CRUD meer — toont vacature/klant/score/fase/contract_status + subtiel
  backoffice-link-icoon bij `helloflex_contract_guid`); `mapCandidate.matches` opgeschoond naar de
  entiteit-shape (placements/contract-velden weg); Matches-pagina (sidebar) stond al op de `/matches`-entiteit.

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
  **Bevestigd 2026-06-21 (beslissing 14):** status-seed = **Lead · Kandidaat · Geplaatst · Inactief**
  (Archief = soft-delete-staat, geen status); funnel-seed = **Gesolliciteerd · Uitgenodigd/Intake ·
  Voorgesteld · Aangenomen · Afgewezen** (op de sollicitatie). **FE-seed-fallback al rechtgezet** in
  `LookupsContext.jsx` (`DEFAULT_STATUSES` + `DEFAULT_FUNNEL_TYPES`). **Resterend (consumers):**
  `CandidatesPage` `intakeCount` (`status==='intake'`) → uit afspraken (B-17.4); `isNoFollowup`
  (`stage==='prospect'`) → `status==='lead'`; `DUMMY_CANDIDATES`-mockwaarden bijwerken; `is_applicant`-
  gating + "toont de funnel"-toggle opruimen (model A); `status: 'intake'` in de dummy-`statusColor`.
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
- [x] **B-15 · Endpoint-rename doortrekken — KLAAR (2026-06-21, door backend-Claude op Danny's verzoek).**
  Alle frontend-calls omgezet en 1-op-1 geverifieerd tegen de backend-routes: `/crm/customers` →
  **`/customers`** (`CustomersPage`, `BranchSection`); alle `/sm/*` → **`/sm_*`** — `/sm_customers(/sync)`
  (`SyncSettings`, `reports/*Table`, `pages/shiftmanager/*`), `/sm_candidates(/sync)` (`WorkflowCanvasEditor`,
  `CandidatesReport`, `ShiftmanagerDashboard`, `CandidatesDetailPage`), `/sm_reports/*` (`ShiftsChartsBlock`,
  `OrdersTable`). 19 bestanden, alleen quoted endpoint-strings (comments ongemoeid). Geen `/crm/`- of
  `/sm/`-endpoint meer in `src/`. ShiftManager-pagina's + Klanten laden weer.

- [ ] **B-16 · Kandidaten-focus (sessie 2) — geconsolideerd, zie CLAUDE.md §3B.** Frontend-werk
  om alles instelbaar + niets hardcoded te maken. Volgorde:
  1. ✅ **Settings-herstructurering** (beslissing 9, herzien 2026-06-22) — GEBOUWD/definitief:
     **Kandidaat** = kandidaat-specifiek (Statussen · Funnelfasen · Contractvormen · Beschikbaarheid ·
     Talentpools · Afwijsredenen · CV-template). **Personalisatie** = gedeelde lookups (Memory · Industrieën ·
     Talen · Niveaus · Geslacht · Contacttype · Notitietypes — gebruikt door klant/contactpersonen etc.).
     **Vacatures** + **Klanten** eigen menu's. **Statussen** kreeg een `requires_reason`-vlag (bv. Inactief).
     **Sub-tabs alfabetisch gesorteerd** (op vertaald label, in `SettingsPage`). i18n ×5.
  2. ✅ **Nieuwe lookup-secties** GEBOUWD (`CandidateCommSettings`): **Contacttype** (`/last-contact-types`)
     + **Notitietypes** (`/note-types`) als 2 tabs onder *Kandidaatlijsten*; `useLastContactTypes`-hook mapt de
     slug → label (bv. `phone`→Telefonisch) in tabel + drawer. i18n ×5. Vullen zodra C-21 (backend) live is.
  3. **Functie-toggle** dropdown↔vrij + strict-guard-werklijst (= B-13, wacht op C-14).
  4. **Velden/tabel** — ◐ deels: ✅ datum **DD-MM-YYYY** overal (`useDateFormat`-default numeriek +
     `EditableFieldTable` date-leesweergave + dob in `ProfileTab`); ✅ **geboorteplaats** (`place_of_birth`
     in `ProfileTab` + `mapCandidate` + `updateCandidate`, wacht op backend C-21 om te persisteren);
     ✅ profieltekst **clear + vergroten/verkleinen** (Make/JS-stijl) in `ProfileTab`. **Rest open:**
     ✅ **skills als lijst** (`SkillsTab` → `layout="list"` met edit/verwijder per regel); ✅ **status/eigenaar
     compacter** in de tabel (status = soft-chip zoals funnel/type, eigenaar-avatar 18px). **Rest open:**
     **Facebook Lead ID** + **last-contact-type** als kolom + in de drawer (wacht op C-21); CV-styling zoals Notes.
  5. ◐ **KPI's**: ✅ **Taken-KPI** toegevoegd (beslissing 10: naast Actieve gesprekken; waarde uit
     `stats.attention.tasks`, C-21). **Rest:** "geen opvolging" + "actieve gesprekken" zijn nog
     frontend-proxy → live zetten zodra `stats.attention` de echte velden levert (C-13/C-21).
  6. ✅ **Bulk type → multi-select add/remove** (beslissing 12) — GEBOUWD: `ActionMenu` kreeg een
     **multi-select-node** (checkbox-opties + bevestigknop, herbruikbaar); type-actie zet de **exacte set**
     (lege set = alle types eraf), stuurt `candidate_types: []`. Regressietest toegevoegd.
     **⚠️ Backend C-15** moet `POST /candidates/bulk/candidate-type` laten accepteren met **`candidate_types: []`**
     (array, REPLACE) i.p.v. alleen single `candidate_type`. ◐ **individuele soft-delete** met check op actieve
     gekoppelde objecten — nog open (wacht op C-21).
  7. **Changelog-tab** op de kandidaat (= B-14, `/candidates/{id}/activity`, wacht op C-16).
  8. **Dark-mode-audit**: hardcoded hex in candidate/settings-componenten → tokens (`--color-*`/`--text*`).
  9. ◐ **Matches read-only** — GEBOUWD: `MatchesTab` is nu weergave-only + subtiel backoffice-link-icoon
     (`helloflex_contract_guid`). **Rest (na backend):** koppel-knoppen Backoffice/ShiftManager (handmatig/bulk/
     workflow, autorisatie-gated, error-terug bij mapping-fout) — groot.
  Recruiter-kleur blijft **per gebruiker** (beslissing 11 — niets te doen, B-11 al klaar).

- [ ] **B-17 · Afspraken/Intakes + intake-rapportage (frontend) — beslissing 13, wacht op C-22.**
  Maakt de funnel-intakefase afdwingbaar én rapporteerbaar. Stappen:
  1. ✅ **Funnelfase-checkbox** in Settings — GEBOUWD: per funnelfase een **"Vereist een afspraak"**
     (`requires_appointment`) toggle + badge in `LookupBlock` (Funnelfasen-tab); stuurt het veld mee op
     create/update. Wacht op backend C-22 om op te slaan. i18n ×5.
  2. **Afspraken-sectie/tab op de kandidaat**: afspraak plannen (`scheduled_at` als **datum+tijd**, recruiter,
     vestiging/locatie, type, status). Lijst + bewerken/annuleren. Zelfde rust/soft-chip-stijl.
  3. **Inconsistentie-signaal**: staat de kandidaat op een `requires_appointment`-fase **zonder** geplande
     afspraak → subtiel waarschuwings-icoon in de header + CTA "afspraak plannen"; bij fase-wissel een prompt.
  4. **Attention-KPI** "Intake zonder afspraak" (`stats.attention.missing_appointment`); **"Intake gepland"**-KPI
     herleiden uit geplande afspraken op een intakefase (níet meer uit `status === 'intake'`).
  5. **Intake-rapport** (module Rapporten/Planning): aantallen per **dag/week/maand × recruiter × vestiging ×
     bron × functie × regio** (`GET /reports/intakes`), klik-tot-filter/drill + **intake-agenda**-overzicht.
     Cross-ref bestaande backlog F3.6 (intake-agenda) + V4 (vacature-intake).
  6. **Datum/tijd**: afspraken in **DD-MM-YYYY HH:mm** (`nl-NL`), consistent met B-16.4.

- [ ] **B-18 · Sollicitaties (applications) — feature-refactor + AI-beoordeling + afwijzing.**
  Eén-groot-plan (Danny, plan goedgekeurd 2026-06-21). **Het backend-contract is als losse prompt aan
  backend-Claude gegeven (níet in deze worklist); de C-23/C-24/C-25-verwijzingen hieronder duiden díe
  prompt aan: C-23 = applications-detailshape + reject · C-24 = beoordelingscriteria · C-25 = afwijzing-
  instellingen.** De oude `ApplicationsPage` (677 regels, inline
  drawer, hardcoded NL, dummy-data) is herbouwd naar de **kandidaat-blueprint** (CLAUDE.md §3A):
  dunne `ApplicationsPage` + `ApplicationsTable` (gedeelde `DataTable`) + `ApplicationsBoard` (kanban) +
  `ApplicationDrawer` op de gedeelde `EntityDrawer`/`EntityHeader`-shell (7 tabs: Sollicitatie · Kandidaat ·
  Vacature · Interviews · Afspraken · Tijdlijn · Notities) + `data/{mapApplication,mocks}` + namespace
  `applications.json` (nl+en). **Fase 1 (skelet) klaar**, draait op `GET /applications` met **mock achter
  `USE_MOCKS`** tot de detail-shape live is (C-20/C-23). Resterend (FE), in volgorde:
  1. **6 drawer-tabs vullen** — Kandidaat (profielsamenvatting + tijdlijn), Vacature (velden + tags +
     gekoppelde criteria-groep read-only), Interviews (WhatsApp samenvatting + transcript), **Afspraken
     (= de `appointments`-entiteit uit B-17/C-22 — niet apart bouwen, hergebruiken)**, Tijdlijn,
     Notities (gedeelde `NotesTab`).
  2. **`MatchScoreBlock`** — render de score uit `application.match.criteria[]` (C-23), niet uit AI-verzonnen
     labels: Algemeen-balk + uitklapbare criteria met toelichting + harde-criterium-markering.
  3. **`RejectionBlock`** — reden-select + toelichting → **voorvertoning** van het bericht (kanaal+template
     uit C-25) → recruiter **bevestigt** → `POST /applications/{id}/reject`; AI-advies/auto-afwijzen tonen
     met `KoiosAiMark` (auto alleen bij harde criteria, anders advies).
  4. **Settings → Personalisatie → Beoordelingscriteria** (`AssessmentCriteriaSettings`): herbruikbare
     criteria-groepen (template) met gewicht + harde-vlag per criterium; per vacature een groep koppelen +
     **override** (C-24). Mirror `StatusListEditor`/`SchemaSection`.
  5. **Afwijzing-settings** uitbreiden (`RejectionSettings`): standaardkanaal (e-mail|WhatsApp) + template per
     reden (C-25), editor in `EmailSettings`-stijl.
  6. **`CandidatesInsightsRow`** extraheren naar gedeeld `components/insights/InsightsRow.jsx` (donuts Fase/
     Vacature/Recruiter + KPI's) zodat applications én candidates dezelfde row delen (geen cross-feature import).
  **Beslissingen (Danny):** criteria = **template + override**; afwijzing = **instelbaar kanaal + bevestigen**;
  AI auto-afwijzen **alleen op harde criteria**. Cross-ref **B-8** (sollicitatie-tab op de kandidaat hergebruikt
  dezelfde `match`-shape) + **B-2** (Koios AI). Hangt op **C-23/C-24/C-25** (+ C-20 seeder).

- [ ] **B-19 · Vacatures (vacancies) — feature-refactor naar de candidate-blueprint.**
  Plan goedgekeurd (Danny, 2026-06-21). De monoliet `VacanciesPage.jsx` (739 r, inline `VACATURES`-dummy,
  hardcoded NL, zelf-gebouwde `Avatar`/`KlantLogo`/`PlatformIcon`/`BarCell`/`Toggle`/`VacatureDrawer`) wordt
  herbouwd naar de **kandidaat-blueprint** (CLAUDE.md §3A/§3B) — losse componenten in `pages/vacancies/`:
  dunne `VacanciesPage` (InsightsRow + **status-tabbladen** uit `/vacancy-statuses` + bulk + paginatie) +
  `VacanciesTable` (gedeelde `DataTable`, kolommen Titel/#/Status/Leads/Sollicitaties/Gepubliceerd/Eigenaar/
  Klant/Gemaakt-op, soft-chips, nieuwe `ApplicantsBarCell`) + `VacanciesBulkBar` (thin `ActionMenu` +
  generieke `bulkMutate`: owner/status/klant/publiceren/tag/notitie/archive) + `AddVacancyModal` +
  `VacancyDrawer` op de gedeelde `EntityDrawer`/`EntityHeader`-shell (tabs: Details · Sollicitaties ·
  Publiceren · Documenten · Tijdlijn · Notities · Statistieken) + `data/mapVacancy` + namespace
  `vacancies.json` (**nl+en** nu; de/fr/es follow-up). **Niets hardcoden:** statussen/fasen/soort-dienstverband/
  senioriteit/opleiding/vacaturesites/sollicitatie-instellingen = settings-lookups (mirror `useGenders`/
  `LookupsContext`), Branche=`/industries`, Categorie=`/functions`, Klant=`/customers`, Eigenaar=`useUsers`.
  Settings → Vacatures uitbreiden met de nieuwe lookup-sub-tabs. **Geen frontend-dummy** — vier UI-states
  dekken leeg; draait op `GET /vacancies` (+ `/vacancies/stats`, `/vacancies/{id}`, bulk). Hangt op **C-26**
  (API + seeder). Cross-ref **B-18** (applications, deelt `InsightsRow`/`ActionMenu`/drawer-shell) + **E2**.

- [ ] **B-20 · Taken/Activiteiten — feature naar de candidate-blueprint.**
  Plan goedgekeurd (Danny, 2026-06-21). De stub `pages/tasks/` (TasksPage+TasksTable, ~70 r) wordt herbouwd
  naar de **kandidaat-blueprint** (§3A/§3B): dunne `TasksPage` (InsightsRow KPI's+donuts + **lijst↔takenbord**-
  toggle + right-panel filters) + `TasksTable` (gedeelde `DataTable`) + `TasksBoard` (kanban, kolommen =
  `/task-statuses`, drag→`PATCH /tasks/{id}`) + `AddTaskModal` ("Toevoegen activiteit") + `TaskDrawer` op de
  gedeelde `EntityDrawer`/`EntityHeader`-shell met **alleen tabjes** (Details · Koppelingen · Reacties ·
  Activiteit) + `data/mapTask`. **Niets hardcoden:** statussen/activiteit-types/prioriteiten = settings-lookups
  via nieuwe **`TaskLookupsContext`** (page-scoped, seed-fallback, mirror `VacancyLookupsContext`); assignee =
  `useUsers`; koppelingen polymorf (kandidaat/sollicitatie/vacature/match/klant/locatie/afdeling/contact/
  workflow). Settings → nieuwe top-level groep **Taken** (Statuses/Types/Priorities via `StatusListEditor`).
  Namespace `tasks.json` (**nl+en**). **Geen frontend-dummy** — vier UI-states; draait op `GET /tasks`
  (+ `/tasks/stats`, `/tasks/{id}`, comments, activity). Hangt op **C-18** (tabellen/endpoints/lookups/seeder).

- [ ] **B-21 · Aangepaste velden — generiek over 8 entiteiten + gedeelde drawer-tab.** *(NIEUW 2026-06-22)*
  De vacature-blueprint (`VacancyFieldsSettings` + `/vacancy-custom-fields` + `custom_fields`-JSON +
  `PublishingTab`) uitrollen naar: **klanten · locaties · afdelingen · contactpersonen · kandidaten ·
  vacatures (✓ al) · taken · matches**. Niets dupliceren — extraheren + hergebruiken:
  1. **Settings:** één herbruikbare `CustomFieldsEditor` (uit `VacancyFieldsSettings`) + een sectie per
     entiteit onder de juiste settings-tab. CRUD add/delete (in-use-protected → 409) + reorder. Vrije tekst
     zoals nu (veldtypes later).
  2. **Drawer:** één gedeelde **"Aangepaste velden"-tab** (`CustomFieldsTab` op de `EntityDrawer`-shell) die
     `entity.custom_fields: [{id,name,value}]` toont + in-place bewerkt (soft-chip-stijl); als config-tab aan
     elke entiteit-drawer hangen.
  3. **Datalaag:** elke `map<Entity>` leest `raw.custom_fields` (zoals `mapVacancy`); waarden terug via de
     bestaande PATCH van die entiteit. i18n nl+en. Hangt op **C-29**.

- [ ] **B-22 · Dashboard de-hardcoden — live KPIs + recente lijsten + echte filters.** *(NIEUW 2026-06-22)*
  `pages/dashboard/Dashboard.jsx` is op **1 KPI na volledig hardcoded** (alleen "Totaal kandidaten" is live via
  `useCandidateCount`). Constante arrays: `RECENT_CANDIDATES/APPLICATIONS/LEADS`, `RUNS`, `CONVERSATIONS`,
  `VESTIGINGEN`, `PERIODES`, statusopties + 7 KPI-getallen. Plan:
  1. **KPIs live:** Nieuwe kandidaten (`/candidates/stats`), Openstaande sollicitaties (`/applications`),
     Actieve vacatures (`/vacancies`, C-26), Actieve klanten (`/customers`, C-27), Leads in pipeline
     (`/opportunities/stats`, **C-28 ✓**), Geplande diensten (planning/SM), Berichten verstuurd (messaging).
  2. **Recente lijsten live:** kandidaten/sollicitaties/leads via `GET …?sort=-created_at&limit=5`. `RUNS` (AI)
     + `CONVERSATIONS` (WhatsApp) **module-gated → echte feed of nette lege staat**, geen nepdata.
  3. **Filteropties echt:** Vestiging → `/locations` (C-6)/klant-vestigingen; status → candidate-status-lookup
     (`LookupsContext`); periode → echte buckets — én de filters **doorzetten** naar de queries (nu doen ze niets).
  4. **Vier UI-states** + module-gating; alle constante arrays weg. Bij voorkeur op **één `GET /dashboard`**
     (C-30) i.p.v. N losse calls. Hangt op **C-30** (+ C-26/C-27, C-18, planning/messaging-feeds).

- [ ] **B-23 · Dashboard visueel herontwerp — charts i.p.v. alleen KPI-blokken.** *(NIEUW 2026-06-22)*
  Nu zijn het 8 losse KPI-blokken + lijsten, terwijl de chart-componenten al bestaan (`components/charts/`:
  `LineChartCard · BarChartCard · PieChartCard · MiniDonut`, `components/insights/InsightsRow`, Recharts 3.8).
  Herontwerp tot een gebalanceerd dashboard (rust/§4) — minder getallen, meer inzicht:
  1. **KPI-strip compacter** — 4 headline-KPI's met sparkline + **voortgang t.o.v. target** (gebruik de
     `kpis`-settings-targets → mini progress/gauge).
  2. **Hero-tijdreeks** (line/area): instroom kandidaten + sollicitaties per week/maand.
  3. **Funnel** sollicitaties (Gesolliciteerd→Aangenomen) — conversie zichtbaar.
  4. **Donut/pie**-verdelingen: kandidaten per status · per recruiter · per bron.
  5. **Bar**: plaatsingen/diensten per maand/vestiging.
  6. **Lijsten blijven** (recente kandidaten/sollicitaties/leads/runs/conversaties) maar compacter — niet alles
     is een chart.
  7. **Filter-reactief** (periode/vestiging/status sturen álle charts) + **module-/rol-aware** layout
     (ATS/CRM/planning-charts naar pakket) + nette lege staten i.p.v. nepdata.
  Hergebruik de bestaande chart-cards + `InsightsRow`; tokens voor dark/light; JetBrains Mono voor cijfers.
  Hangt op **C-31** (charts-data) + **C-30** (summary) + **B-22** (de-hardcoden).

- [x] **B-24 · Dashboard → klik past overal het filter toe op de doelpagina (page-agnostisch).** ✅ KLAAR (2026-06-22) *(generiek `goTo(page,intent)` in App.jsx; kandidaten consumeren `intent` live — attention/status/owner/funnel; sollicitaties/kansen/matches/taken krijgen `intent` al doorgegeven, seeden zodra die pagina's 'm lezen)*
  Geldt voor **heel het dashboard**, niet per KPI: elk element dat navigeert (KPI, chart-segment, "Alle X",
  straks een Matches-blok) geeft z'n filter mee. Nu navigeert het alleen (`onNavigate(page)` = `setActivePage`).
  1. **Generiek mechanisme:** `navigate(page, intent?)` met `intent` = page-agnostisch object (bv. `{status:'…'}`,
     `{stage:'open'}`, `{attention:'stale6m'}`, `{owner:id}`). App bewaart `navIntent` en geeft 'm aan **élke**
     pagina als prop; elke lijstpagina leest háár relevante keys in een `useEffect`, seedt het filter, wist intent.
     Geen URL-routing (pagina's via state).
  2. **Volledige klik-mapping:** KPI Totaal → — · Niet benaderd >6 mnd → `attention=stale6m` · Nooit benaderd →
     `attention=neverContacted` · Openstaande taken → Taken `status=open` · Kansen/Pijplijnwaarde → Kansen
     `stage=open` · chart status-segment → Kandidaten `status=<waarde>` · recruiter → `owner=<id>` · funnel →
     Sollicitaties `stage=<waarde>` · kansen-fase → Kansen `stage=<waarde>` · "Alle X" → lijst zonder filter ·
     **(toekomstig) Matches-blok → Matches `stage`/`score`**.
  3. **Chart-detail:** data-items krijgen een **`filterValue`** (slug/id) náást de count — de zichtbare `name`
     (label) ≠ de filter-waarde; `onItemClick` bouwt het filter uit `filterValue`.
  4. **Per pagina (consumeren):** Kandidaten ✅ (filters bestaan, alleen seeden) · Sollicitaties (B-18) / Kansen /
     **Matches** / Taken (B-20) ◐ (doelpagina moet de geseede filter ondersteunen — komt mee als die pagina's rijpen).
  - **Caveat:** de attention-filter is op de kandidatenpagina nu **client-side** (predicate ≠ server-filter) →
    doorklikken = zelfde gedrag als de tile; server-brede attention-filtering wacht op backend. Status/owner/funnel/
    stage zijn wél server-filters.

- [x] **B-25 · Instroom-chart → gegroepeerde bar, 3 series per week.** ✅ KLAAR (2026-06-22) *(nieuw `WeeklyBarChartCard` met legenda; merge van `charts.timeseries` candidates_in+applications+matches → `[{name,kandidaten,sollicitaties,matches}]`; bar-klik → `period`-intent)*
  De huidige chart toont maar **één serie** (`candidates_in`) via `LineChartCard` (single-series, tooltip
  hardcodet "kandidaten"). Doel = **3 series per week** = de funnel: nieuw ingeschreven **kandidaten** ·
  **sollicitaties** · **matches**. Plan:
  1. **Nieuw gedeeld component `WeeklyBarChartCard`** (`components/charts/`): gegroepeerde bars (3 `<Bar>`,
     géén stackId), **legenda**, 3 kleuren (primary/secondary/accent), i18n-tooltip (geen hardcoded "kandidaten"),
     dark-mode tokens, week-labels. `LineChartCard` blijft voor single-series (CandidatesReport — niet aanpassen).
  2. **Data-merge:** `candidates_in[]` + `applications[]` + `matches[]` per `name` (week) samenvoegen →
     `[{ name, kandidaten, sollicitaties, matches }]`.
  3. **Hero-plaatsing** (full-width, hogere `height`) + optionele **week/maand-toggle** (`bucket`-param, C-31).
  4. **Klik-tot-filter:** een bar/week aanklikken → `navigate('candidates'|'applications'|'matches', { period: <week> })`
     via het B-24-mechanisme.
  5. i18n: `dashboard.json` uitbreiden met serie-labels (Kandidaten/Sollicitaties/Matches).
  Hangt op **B-24** (intent) + **C-31** — die moet `timeseries.applications[]` **én** `timeseries.matches[]`
  leveren (nu alleen `candidates_in`).

### ◐ Recent afgerond aan de frontend (ter context)
**Opportunities (Kansen)-shell** — eigen folder `pages/opportunities/` (zoals Matches), met config-gedreven
KPI-row (donuts Fase/Eigenaar + KPI's Kansen/Pijplijnwaarde/Gem. waarde via de gedeelde `InsightsRow`),
`OpportunitiesTable` op de gedeelde `DataTable`, sidebar-item "Kansen" + routing + gating + i18n (nl/en).
404-tolerant; wacht op **C-28** voor echte data (+ betekenis-vraag, zie C-28). ·
**KPI's = eigen settings-menu** met **subtabjes** (Leads / Kandidaten / Sollicitaties / Klanten —
schema-gedreven, bestaande KPI's verdeeld; meer per categorie kan Danny aanvullen) · **2FA/Security
verplaatst naar het eigen Profiel** (tab "Beveiliging"; weg uit org-instellingen — MFA is per-gebruiker;
Profiel breder gemaakt) · ontbrekende `groups.kpis`/`groups.security`-labels toegevoegd (5 talen) ·
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
**Beschikbaarheid (availability) als aparte as** (A4): lookup-sectie *Personalisatie → Beschikbaarheid* (`/availability-options`) + drawer-picker los van status; `LookupsContext`+`mapCandidate`+PATCH `availability`. `is_applicant`-funnel-gating zat al in de drawer. ·
**Sidebar: Matches + Taken** (modulaire pages `pages/matches/`+`pages/tasks/`, gegate als ATS-pagina, GET `/matches`·`/tasks` met lege-staat) · **Sollicitaties: tab "Matched"** (fase Aangenomen, uit Actief).

---

## C. Backend-Claude — open

Tenant-scoped, special-category (gezondheid). Secrets nooit loggen.

### 🟠 C-27 · Workflow-modules: per-entiteit **templates** + uitvoering (FE → backend)
De modulekiezer is herbouwd: per entiteit **één module** met een **`action`**-veld i.p.v. losse
Ophalen/Filter/Acties-modules. Frontend levert per stap een `type` (bv. `candidates`) + `config`.
Backend moet per `type × action` een **uitvoer-template/handler** hebben:
- **`candidates`** (blueprint; daarna `applications`/`vacancies`/`matches`/`opportunities`/`tasks`/`customers`/`planning`):
  - `action: 'Ophalen'` → lezen met `config.filters` = `{ logic:'AND'|'OR', conditions:[{ field, operator, value }] }`,
    plus `config.sort` + `config.limit`. Output = records (worden de "bundle" voor volgende modules).
  - `action: 'Aanmaken' | 'Bijwerken'` → `config.fields` (naam/waarde-paren); Bijwerken kiest de set via `config.target` (zelfde filtershape).
  - Kandidaat-specifiek: Bijwerken met `reason` + `effective_from` (was `status_set` — gedateerde/beredeneerde statuswissel);
    `action: 'Werkervaring toevoegen'` met `experience_source`/`experience_position` (was `experience_add`).
- **Operators** in filters: `= ≠ > < ≥ ≤ bevat "bevat niet" "is leeg" "is gevuld"`. `action` ontbreekt → behandel als `'Ophalen'`.
- **Vervangen/verwijderd** (frontend weg): `candidates_fetch`, `candidate_filter`, `status_set`, `experience_add`.
  Volgt nog: idem voor `applicants_*` en `shifts_*` zodra die entiteit-modules er zijn.
- **Webhook-trigger (1→1):** de trigger-stap draagt `webhook_id`; `POST /webhook/{token}` moet de gekoppelde workflow
  draaien met de payload als trigger-output. Lookups voeden later de filter-waarden (status/pool/…); nu vrij getypt.

### 🔴 C-0 · Volledige seeder (Yesway **én** demo) — cross-cutting eis (Danny)
**Beide tenants moeten een volledige database hebben.** De seeder (`php artisan dev:reset` / `migrate:fresh`)
vult voor **Yesway** én **demo**: alle **lookups** (statuses/funnel/candidate_types/availability/genders/
languages/language_levels/industries/functions/rejection-reasons/last-contact-types/note-types/vacancy-*),
plus realistische **sample-data** (kandidaten met álle velden gevuld, vacatures, sollicitaties, matches, taken,
afspraken, documenten, pools, notities, activiteiten). Geen lege schermen meer.

### 🔴 C-23 · Veld-inventaris kandidaat (FE → backend) — "alle velden uit de backend"
**Bron van waarheid = `src/pages/candidates/data/mapCandidate.js`.** De API (`GET /candidates` lijst +
`GET /candidates/{id}` detail) moet deze velden leveren (snake_case), en de **seeder moet ze vullen**.
Lijst mag lichter zijn; detail levert alles. Sub-entiteit-contracten staan in **C-2** (niet herhaald).

- **Kern (lijst+detail):** `id`, `first_name`, `last_name`, `middle_name`, `function_title`,
  `candidate_types[]`, `status`, `availability`, `funnel_type` (transitioneel; funnel hoort op de sollicitatie),
  `owner{ id, name, avatar_color }`, `city`, `province`, `last_contact_at`, `last_contact_type`,
  **`source`** (lead-bron, voor intake-rapport), **`facebook_lead_id`** (alleen indien gevuld), `created_at`.
- **Persoonlijk/contact/adres (detail):** `email`, `phone`, `street`, `house_number`, `house_number_suffix`,
  `postal_code`, `gender`, `nationality`, `date_of_birth`, **`place_of_birth`**, `linkedin_slug`, `photo_url`,
  `summary`, `tags[]`, `branches[{ id, name }]`, `pools[{ id, name, color }]`.
- **Status/beschikbaarheid-historie (besl. 15):** `status_since`, `availability_since`, `availability_reason`
  (+ evt. `status_reason`) → "Inactief sinds …".
- **Afspraken (C-22):** `has_planned_appointment`, `next_appointment_at`, `appointments[]`.
- **Consent (C-11):** `whatsapp_consent`, `email_consent`, `newsletter_consent` (+ `_at`).
- **AI:** `koios_advice{ action, label, reason, score, pool_hint }`.
- **Sub-entiteiten (zie C-2/C-3/C-8/C-10):** `experiences[]`, `educations[]`, `certifications[]`, `skills[]`,
  `languages[]`, `documents[]`, `matches[]`, `applications[{ id, vacancyTitle, stageLabel, stageColor }]`,
  `notes[]`, `timeline[]`.
- **Nested (detail):** `preferences{}` (C-2), `zzp{}` (C-2), `planning_settings{}`.
- **`stats{}` (detail):** `matches_count`, `applications_count`, `shifts_count`, `hours_worked`.
- **`GET /candidates/stats.attention{}`:** `stale_6m`, `never_contacted`, `no_followup_planned`,
  `active_conversation`, `tasks`, `missing_appointment`, `intake_planned`.
> **Regel (CLAUDE.md §0/§3B):** niets hardcoded op de FE — elk getoond veld/optie komt uit de backend.
> Onbekende/lege velden: lever `null`/`[]` (de FE heeft fallbacks), maar de **seeder vult ze realistisch**.

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
> **🔴 ACTIE NU (door Danny gemeld, screenshot):** de live `/settings/candidate-lookups` geeft nog de
> OUDE, te lange statussenset terug (Prospect · Intake · Actief · Inactief · Ziek · Verlof · Extern ·
> Geblokkeerd · Uitstroom · Verwijderd). **HERSEED naar exact 4:** `lead` (Lead) · `candidate` (Kandidaat) ·
> `placed` (Geplaatst) · `inactive` (Inactief) — niets meer. Ziek/Verlof horen bij `/availability-options`;
> Archief = soft-delete (`deleted_at`), geen status. Funnel-lookup → `applied · invited · proposed · hired ·
> rejected`. **De frontend leest deze lookup live; zonder herseed blijft de oude lijst zichtbaar** (bv. in
> "Nieuwe kandidaat"). Draai daarna `php artisan dev:reset` / `migrate:fresh` zodat **zowel Yesway als demo**
> de nieuwe set + volledige sample-data hebben (zie ook de seeder-eis onderaan dit item).

> **✅ Backend leverde 2026-06-22** (dev:reset groen, beide tenants, 51/51 tests): 4-statenmodel + funnel
> geünificeerd op `application_stages` (`applied·invited(appt)·proposal·hired·rejected`) + `candidate.applications`
> + **C-15 array**. **FE stemde af:** funnel-fallback `proposed`→**`proposal`** (FE keyt op `value`, dus akkoord).
>
> **🔴 FE-ANTWOORDEN op de 3 backend-vragen + 1 correctie (2026-06-22, dit is de afspraak):**
> 1. **Status-slug = `matched` (label "Gematched"), NIET `placed`** (besl. 16; Danny: "moet Gematched zijn").
>    Hernoem de geseede `placed` → `matched` én laat de automatisering `matched` zetten.
> 2. **hired → `matched` op het moment dat de Match wordt aangemaakt** (dus bij fase `hired`), **niet** wachten
>    op contractbevestiging. (`matched` = "heeft een actieve Match"; contract is een latere stap op de Match.)
> 3. **Directe Match (C-10.6):** `POST /matches { candidate_id, vacancy_id (VERPLICHT), owner_id?, match_score? }`.
>    Een Match = kandidaat↔vacature (geen kandidaat-only). Zet **óók** status `matched` (zelfde regel als #2).
>    Match start met `contract_status: none`.
> 4. **`proposal` is akkoord** (behoud de stabiele key; FE keyt op `value`).
>
> **➕ Nog toevoegen aan het statusmodel (besl. 16, ontbreekt nu in de reseed):**
> - **`unplaceable`** (Niet bemiddelbaar) + veld **`available_again_date`** (datum "weer beschikbaar") → voedt de
>   heractiverings-workflow (E12 12.6); op die datum automation → `candidate`.
> - **Blacklist = aparte boolean-vlag** (`blacklisted` + reden), GEEN status. **Archived = soft-delete** (`deleted_at`).
> - **Inactief-guard:** alleen als geen actieve Match én (Planning-module) niet ingepland; **reden verplicht**.
> - **Filters:** `inactive`/`blacklisted`/archived standaard verbergen in `GET /candidates` + `/candidates/stats`
>   (param om te tonen), zodat KPI-totalen dalen.
> **Coördinatie:** de twee automatisering-gaten (#2 hired→matched, #3 POST /matches) + C-22 raken de Match/Application-
> bestanden van de collega → eerst afstemmen. Danny: geef akkoord om scoped te committen.

- Kandidaat-status = configureerbare lifecycle-lookup per tenant (**default: Lead → Kandidaat**;
  later evt. Inactief/Archief). Scheid lifecycle van beschikbaarheid (Beschikbaar/Ziek/Verlof als
  apart veld, pas na plaatsing relevant). **Prospect en Sollicitant zijn géén lifecycle-status.**
- **"Sollicitant" = afgeleid:** een Kandidaat met ≥1 lopende sollicitatie. De frontend onthult de
  funnel op basis van **`candidate.applications` (niet leeg)**, niet op een status-vlag → de eerder
  bedachte `is_applicant`-vlag is niet meer nodig (mag vervallen).
- Expose `candidate.applications`: `[{ id, vacancyTitle, stageLabel, stageColor }]` voor de read-only
  fase-chips. Eén kandidaat kan meerdere (en herhaalde) sollicitaties hebben; bewerkbare fase leeft op
  de sollicitatie zelf. Definieer gedrag bij ontkoppelen/afsluiten van een sollicitatie.
- **Status/beschikbaarheid-wijzig-log (beslissing 15):** leg per status- én beschikbaarheidswissel
  `effective_from` (datum) + `reason` (bij beschikbaarheid verplicht) vast. Lever per kandidaat
  `status_since` / `availability_since` (+ reden) terug zodat de frontend "Inactief sinds …" / "Niet
  beschikbaar sinds … · reden" kan tonen. **Automatisering:** loopt de laatste match/opdracht af en werkt
  de kandidaat niet meer → status **Inactief** met `effective_from` = einddatum opdracht (later ook de
  planning-module raadplegen). Koppel aan de audit (C-16); geen PII in de log-properties.
- **Bevestigde seed (beslissing 14) — gelijk goed zetten voor álle tenants; klant kan zelf bijmaken/CRUD:**
  - **Statussen (lifecycle):** `lead` (Lead) · `candidate` (Kandidaat) · `placed` (Geplaatst) ·
    `inactive` (Inactief). **Archief = soft-delete-staat (`deleted_at`), géén losse status.** Ziek/Verlof
    horen bij beschikbaarheid (apart). De oude seed (active/sick/leave/external/blocked/outflow/deleted) **weg**.
  - **Funnel-fases (per sollicitatie):** `applied` (Gesolliciteerd) · `invited` (Uitgenodigd/Intake,
    `requires_appointment=true` als default, zie C-22) · `proposed` (Voorgesteld) · `hired` (Aangenomen) ·
    `rejected` (Afgewezen). De oude candidate-`funnel_type` (prospect/intake/pool/alumni) **opheffen** en
    herverdelen: prospect→status `lead`, intake→funnel `invited`, pool→talentpool/`candidate`, alumni→`inactive`.
  - **Status↔funnel = automatisering (geen gekoppeld veld):** default-regels, per tenant in workflow aanpasbaar —
    1e sollicitatie → Lead wordt Kandidaat; `hired` → maak Match + status `placed`; `rejected` zonder andere
    lopende sollicitatie → blijft `candidate`.
  - **Twee wegen naar een plaatsing** (beide instroom: nieuwe Lead óf bestaande Kandidaat): (1) **via
    sollicitatie/funnel** → `hired` wordt Match→plaatsing; (2) **directe Match** zonder funnel → plaatsing.
    Beide eindigen in een plaatsing → status `placed`. Endpoint moet **direct een match** kunnen maken zonder sollicitatie.

### ☐ C-11 · Kandidaat — kanaal-consent (opt-in)  *(NIEUW)*
Frontend toont nu 3 opt-in toggles (WhatsApp / e-mail / nieuwsbrief) in de Communicatie-tab,
opgeslagen via `PATCH /candidates/{id}` als `consent: { whatsapp_opt_in, email_opt_in,
newsletter_opt_in }` (bool). AVG: leg per toestemming ook **tijdstip + bron** vast
(wanneer/hoe gegeven) en lever die terug in GET-detail. Geen marketing-verzending zonder opt-in.

### ✅ C-12 · Recruiter-kleur in de owner-payload — BACKEND KLAAR (2026-06-21)
`GET /candidates` geeft nu per rij `owner: { id, name, avatar_color }` terug (`avatar_color`
toegevoegd in `attachOwners()` + `CandidateListResource`). `null` als de recruiter geen
kleur heeft gekozen → frontend valt terug op de automatische kleur. Het eigenaar-icoon in
de kandidatentabel kan nu de gekozen kleur tonen.

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

### ✅ C-14 · `/functions` lookup + free-entry-toggle — BACKEND KLAAR (2026-06-21)
Live + geseed op demo + yesway (= FE `DEFAULT_FUNCTIONS`, dus dropdown én beheersectie lezen dezelfde
bron). 6 tests. `useFunctions` matcht al (`{data, allow_free_entry}`). Contract:
```
GET    /functions             → { data:[{id,name,position,in_use}], allow_free_entry:bool }   perm candidates.view
POST   /functions             { name, position? }              → 201 {id,name,position}        perm candidates.update
PUT    /functions/{id}        { name?, position?, active? }    → {id,name,position,active}      perm candidates.update
DELETE /functions/{id}        → 204                                                            perm candidates.update
PUT    /functions/reorder     { ids:[...] }                    → { ok:true }                   perm candidates.update
PUT    /functions/free-entry  { allow_free_entry:bool }        → { allow_free_entry }          perm candidates.update
GET    /functions/mismatches  → [{ entity:'candidate', id, name, function, count }]            perm candidates.update
```
- **`allow_free_entry` default `true`** (opgeslagen als tenant-setting `functions.allow_free_entry`).
- **Strict-guard:** `free-entry {false}` geeft **409 `{ message, mismatches:[...] }`** zolang er
  kandidaat-functiewaarden buiten de lijst staan; `mismatches` = dezelfde shape als `GET /functions/mismatches`
  (één rij per off-list waarde, `count` = aantal kandidaten, `id`/`name` = voorbeeld). `true` mag altijd.
- Strict-guard checkt **`candidates.function_title`** (case-insensitive). Vacatures hebben nog géén
  functie-veld → die komen later in de check (gemeld). Eén opgeslagen string, geen tweede veld.
→ **B-13** kan de toggle + werklijst bouwen.

### ◐ C-15 · Kandidaat-bulk-mutaties — BACKEND KLAAR (2026-06-21), 1 uitbreiding nodig
> **⚠️ Uitbreiding (B-16.6, beslissing 12):** `POST /candidates/bulk/candidate-type` moet nu een **array**
> `candidate_types: [..]` (REPLACE met de exacte set; **lege array = alle types eraf**) accepteren naast/i.p.v.
> de huidige single `candidate_type`. Frontend stuurt al `candidate_types`. Validatie tegen de `candidate_types`-lookup; lege set toestaan.

Geleverd + getest (11 tests: feature + authz + tenant-isolatie). **B-3 kan live.** Bevestigd:
- **Response-keys:** `owner|funnel-stage|candidate-type|tags/remove|notes` → `200 { updated[], skipped[] }`;
  `archive` → `{ archived[], skipped[] }`; `restore` → `{ restored[], skipped[] }`. `skipped` = onbekend /
  andere tenant / al in doeltoestand.
- **`candidate_ids`** = 1..**500** (`>500` → 422 op `candidate_ids`), elk een uuid.
- **`candidate-type` = REPLACE** (zet `candidate_types` op exact `[candidate_type]`).
- **`funnel_type`** wordt gevalideerd tegen de `funnel_types`-lookup (= `prospect|intake|pool|alumni`);
  `candidate_type` tegen `candidate_types`.
- **`owner_id`** moet een user **in deze tenant** zijn (anders 422 op `owner_id`).
- **Archiveren = soft-delete** (`deleted_at`, herstelbaar via `restore`). `GET /candidates` én
  `/candidates/stats` **verbergen gearchiveerden standaard**; `?include_archived=1` toont ze.
- **Perm:** `archive`/`restore` = `candidates.delete` (403 zonder), de rest = `candidates.update`.
  Audit-log `candidates` per actie met **alleen ids/slugs** (tag-tekst en notitie-body níet gelogd).

<details><summary>oorspronkelijke spec (ter referentie)</summary>

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
</details>

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

### ☐ C-18 · Taken/Activiteiten — tabellen + endpoints + lookups + comments + seeder  *(NIEUW — uitgebreid 2026-06-21, voedt B-20)*
> Volledig contract voor de **Taken-feature** (candidate-blueprint: KPI-row + lijst↔takenbord +
> drawer met tabjes + "Toevoegen activiteit"-modal). Tenant-scoped, in-use-protected (409),
> geseed, vertaalbaar (labels per tenant). **Niets hardcoded** — statussen/types/prioriteiten
> zijn lookups. Frontend = B-20 (`pages/tasks/` + `TaskLookupsContext` + Settings-groep Taken).
>
> **DB-conventie:** elke schemawijziging in de bestaande `create_<table>`-migratie vouwen — géén
> `add_*`/`alter_*`-migratie; nieuw migratiebestand alleen voor een nieuwe tabel.

**Tabellen**
- **`tasks`** (soft-delete): `id, tenant_id, title, type_id?(task_types), status_id(task_statuses),
  priority_id?(task_priorities), assignee_id?(users — **null = bureau/onbewerkt**), due_date?,
  description?(text, ≤5000), created_by(users — eigenaar), completed_at?, created_at, updated_at,
  deleted_at?`.
- **`task_statuses`** — lookup (board-kolommen): `id, tenant_id, label, color, sort_order,
  is_done(bool), active`. **`is_done` markeert de afgeronde kolom — nooit "Afgerond" hardcoden**
  (de frontend leidt KPI "afgerond/open" hieruit af). Seed: *TeDoen · In behandeling ·
  Afgerond(is_done=true)*.
- **`task_types`** — lookup: `id, tenant_id, label, color?, sort_order, active`. Seed: *Taak ·
  Belafspraak · E-mail · Notitie*.
- **`task_priorities`** — lookup: `id, tenant_id, label, color, sort_order, is_default(bool),
  active`. Seed: *Laag · Normaal(is_default) · Hoog*.
- **`task_links`** — polymorfe koppeling, **meerdere per taak**: `id, task_id, linkable_type,
  linkable_id`. Toegestane types: `candidate · application · vacancy · match · customer ·
  location · department · contact · workflow`. (Eén taak kan tegelijk kandidaat + klant + contact
  koppelen, zoals de modal.)
- **`task_comments`** (Reacties): `id, task_id, author_id(users), body(text), created_at`.

**Endpoints**
- `apiResource /tasks` (index/show/store/update/destroy; soft-delete). **Index-filters:**
  `status[]`, `priority[]`, `type[]`, `assignee_id[]`, `linkable_type`, `q`(zoek titel/omschrijving),
  `due_from`/`due_to`; paginatie (zoals `/candidates`).
- `GET /tasks/stats` (server-breed, niet pagina): counts `by_status`, `by_priority`, `by_type`,
  `by_assignee` + `open`(niet-is_done), `overdue`(due_date<vandaag & niet-done), `due_today`,
  `completed`.
- **Lookup-CRUD** (StatusListEditor-compatibel: `name`+`color`+`sort_order`, reorder, 409 in-use):
  `/task-statuses` (met `is_done`), `/task-types`, `/task-priorities`.
- `GET|POST /tasks/{id}/comments` + `DELETE /tasks/{id}/comments/{commentId}`.
- `GET /tasks/{id}/activity` — changelog (status/veld-wijzigingen met effectieve datum + auteur).
- **Koppelingen:** accepteer `links: [{type, id}]` in store/update-body **of** aparte
  `POST|DELETE /tasks/{id}/links`. Bevestig welke je kiest.

**GET-rij die de frontend leest** (`mapTask`):
`{ id, title, type{value,label,color}|type_label/type_color, status{value,label,color,is_done}|status_*,
priority{value,label,color}|priority_*, assignee{id,name,avatar_color}|assignee_name (null=bureau),
owner{id,name}|created_by{...}, due_date, completed_at, created_at, links:[{type,id,label}], comment_count }`.
**Detail** (`mapTaskDetail`, `GET /tasks/{id}`) voegt toe: `description`, volledige `links`,
`comments:[{id,author{id,name},body,created_at}]`, `activity:[{id,author,description,created_at}]`.

**Seeder:** ~12–15 taken verdeeld over bestaande **kandidaten/sollicitaties/klanten/contacten**;
gevarieerde type/status/prioriteit/einddatum (incl. **enkele overdue** + **enkele afgerond**),
2–3 met reacties, wisselende assignees (+ minstens één met `assignee_id=null` = bureau). Seed ook
de 3 lookups. **Voedt tevens** de kandidaat-**Taken-KPI** (`stats.attention.tasks` aan kandidaat
gekoppelde taken — zie C-21).

### ☐ C-19 · `/matches` — tabel + endpoint + seeder  *(NIEUW)*
Kandidaat↔vacature-fit mét score (≠ bestaande `placements` = contract/plaatsingsrecords). `matches`: `id, candidate_id, vacancy_id?, customer_id?, score(0-100)?, stage?(of application_stage_id), owner_id?`.
GET-rij: `{ id, candidate{id,name}|candidate_name, vacancy{id,title}|vacancy_title, client/customer{name}|client_name, score, stage(+_label/_color?), owner{name}|owner_name, created_at }`.
Seeder: ~10 matches die bestaande kandidaten↔vacatures koppelen (score 35–100). Voedt `pages/matches/`. **Vraag aan backend:** matches als eigen tabel of als view over applications?

### ☐ C-20 · Applications — seeder + `match_score`  *(NIEUW — tabel/endpoints bestaan al)*
Kolom `match_score` (tinyint nullable) op `applications`. Index/show moet voor de lijst leveren: `candidate{name}`, `vacancy{title}`, stage `{label,color}`, status, source, owner/created_by `{name}`, `match_score`.
Seeder: ~10 sollicitaties over bestaande kandidaten+vacatures, gevarieerde fases (incl. één "matched/aangenomen" eindfase + één afgewezen). De **Matched-tab** = applications in die eindfase; bevestig de stage-slug.

### ☐ C-21 · Kandidaten-focus (sessie 2) — lookups, velden, seeder, soft-delete  *(NIEUW)*
Voedt B-16. Alles tenant-scoped, in-use-protected (409), geseed, vertaalbaar (labels per tenant).
- **`/last-contact-types`** — CRUD-lookup zoals `/genders`. **Seed: Email · Telefonisch · WhatsApp.**
  Klant kan ze beheren. Voedt het `last_contact_type`-veld + de tabelkolom.
- **`/note-types`** — CRUD-lookup, geseed met enkele defaults, zichtbaar in instellingen.
- **Seeder**: zet op kandidaten een **random `last_contact_at`** én een **random `last_contact_type`**
  (uit de 3) zodat de KPI's "niet benaderd >6 mnd / nooit benaderd / geen opvolging" te testen zijn.
- **Velden teruggeven** in lijst + detail: **`place_of_birth`** (geboorteplaats) en **`facebook_lead_id`**
  (alleen tonen als gevuld).
- **`stats.attention`** afmaken (= C-13): `no_followup_planned`, `active_conversation`, plus een
  **`tasks`-telling** (aan de kandidaat gekoppelde taken, hangt op C-18) voor de nieuwe Taken-KPI.
- **Soft-delete op de kandidaat** (individueel, naast bulk-archive C-15): preflight die **actieve
  gekoppelde objecten** (lopende sollicitaties/matches/plaatsingen) detecteert → weiger + lever de lijst
  zodat de frontend een "overzetten/herverdelen"-pad kan tonen. **Hard-delete alleen** als er niets hangt
  (API-enforced). Respecteer erased/geanonimiseerde staat.
- Hangt verder samen met **C-7** (industries seeden), **C-14** (functions + free-entry), **C-16** (changelog).

### ☐ C-22 · Afspraken/Intakes — funnelfase-vlag + entiteit + intake-rapportage  *(NIEUW — voedt B-17)*
**Doel:** de "intake"-fase afdwingbaar maken zodat we erop kunnen rapporteren. Tenant-scoped,
special-category (gezondheid), AVG. Drie delen:

**1. Funnelfase-vlag `requires_appointment` (config, geen hardcode).**
- Voeg op de **funnel_types-lookup** (`/settings/candidate-lookups/funnel-types`) een boolean
  **`requires_appointment`** toe (default `false`), exact zoals `is_applicant` op statuses al werkt
  (kolom + FormRequest + resource + GET geeft 'm terug). Klant bepaalt zelf welke fase ("Uitgenodigd",
  "Intake gepland", …) een afspraak vereist — wij hardcoden die naam nooit.

**2. Afspraken-entiteit `appointments` (de afdwingbare data).**
- Tabel (tenant-scoped, soft-deletes): `id (uuid)`, `tenant_id`, `candidate_id (uuid, req, FK)`,
  `application_id (uuid, null, FK)`, `type (string, default 'intake'; later lookup `appointment_types`)`,
  `scheduled_at (datetime, req)`, `duration_min (int, null)`, `owner_id (users — de recruiter; default =
  kandidaat-owner)`, `location_id (FK locations, null — vestiging)`, `status (enum: planned|completed|
  no_show|cancelled, default planned)`, `source (string, null — overgenomen van kandidaat bij aanmaken)`,
  `outcome (string, null)`, `notes (text, null)`, timestamps.
- Endpoints: `GET/POST /candidates/{id}/appointments`, `PATCH/DELETE …/appointments/{aid}` (sub-entiteit-
  contract als C-2: POST geeft record incl. `id` terug). Plus tenant-breed **`GET /appointments`**
  (filters: `type`, `status`, `from`, `to`, `owner_id`, `location_id`) voor agenda + rapport, geordend op
  `scheduled_at`. Perms: view = `candidates.view`, schrijf = `candidates.update`.

**3. Consistentie + rapportage-velden.**
- **Inconsistentie, niet hard blokkeren:** zet een kandidaat/sollicitatie op een funnelfase met
  `requires_appointment=true` zonder een **planned** afspraak → toestaan, maar markeren. Geef per kandidaat
  **`has_planned_appointment` (bool)** + **`next_appointment_at`** terug, en tel in **`stats.attention`** een
  **`missing_appointment`** (kandidaten op een `requires_appointment`-fase zonder geplande afspraak,
  meetellend met de actieve filters). Voeg ook **`intake_planned`** toe (geplande intake-afspraken) zodat de
  "Intake gepland"-KPI uit afspraken komt i.p.v. `status==='intake'`.
- **Zorg dat de rapportage-dimensies bestaan/joinbaar zijn:** recruiter (`owner_id`), vestiging
  (`location_id`/branch), **bron (`source`)** — **voeg `source` toe aan kandidaten als die ontbreekt**
  (lead-bron; Facebook-lead → `source='facebook'`), functie (`function_title`/vacature), regio (`province`).
- **`GET /reports/intakes`** — params: `bucket=day|week|month` (ISO-week, `nl-NL`), `from`, `to`,
  `group_by=recruiter|location|source|function|region`, + filters. Response bv.
  `{ series:[{ key, label, count }], by_recruiter:[…], by_location:[…], by_source:[…], by_function:[…],
  by_region:[…], total }`. Count = **intake-afspraken** (type intake / op `requires_appointment`-fase) met
  `scheduled_at` in de range, gejoind op de dimensies. Tenant-scoped, geen PII in logs.
- **Seeder:** ~10 afspraken (gevarieerde `scheduled_at` over de komende weken, status mix), gekoppeld aan
  bestaande kandidaten + een recruiter, zodat de intake-KPI én het rapport meteen data tonen.
- Hangt samen met **C-10** (status/funnel-model), **C-13** (attention-velden), **C-18/19/20** (tasks/matches/
  applications) en **C-4/C-6** (locaties als vestiging-dimensie).

### ☐ C-26 · Vacatures (vacancies) — tabel + endpoints + bulk + lookups + seeder  *(NIEUW — voedt E2 + B-19)*
> *(C-23/24/25 zijn informeel geclaimd door de applications-losse-prompt in B-18; daarom dit nummer C-26.)*
**Doel:** de vacature-feature voeden met **echte** data zodat de frontend (candidate-blueprint) lijst, KPI's,
drawer, bulk én conversieratio op de API draaien — **geen frontend-dummy meer**. Tenant-scoped, AVG /
special-category. Engels in code, `snake_case` in de API. Lijst = bare array of `{data,meta}`, detail = bare
object of `{data}`. Spiegelt qua aanpak C-18/19/20 (tabel + endpoints + seeder) en C-15 (bulk-contract).

**1. Tabel `vacancies` — vouw ÁLLES in de bestaande `create_vacancies`-migratie (géén `add_*`/`alter_*`).**
`id (uuid)`, `tenant_id`, `code (string, leesbaar bv. 00107)`, `title (req)`, `status_id (FK vacancy_statuses)`,
`owner_id (users)`, `customer_id (FK customers, null)`, `employment_type_id (FK vacancy_employment_types, null)`,
`function_id (FK functions, null — categorie/functie)`, `industry_id (FK industries, null — branche)`,
`seniority_id (null)`, `education_id (null)`, gestructureerde locatie (street/house_number/postcode/city/province
conform C-6) + vrij `location (string)`, `salary_min/max`, `salary_period`, `hours_min/max`, `experience_years (null)`,
`description (text)`, `skills` (json/relatie), `tags` (json/relatie),
`application_settings (json: {cv,cover_letter,photo,remarks,interview_consent} → enum required|optional|hidden)`,
`published (bool)`, `published_channels` (relatie naar `vacancy_channels` met per-kanaal staat),
`leads_count` (kolom of afgeleid), soft-deletes, timestamps.

**2. Endpoints (native, clean naming, geen prefix).**
- `GET /vacancies` paginated, server-filters: `search, status[], owner_id[], customer_id[], category[], industry[],
  employment_type[], published`. GET-rij die de frontend leest: `{ id, code, title, status{value,label,color},
  leads_count, applications_count, applications_by_phase{applied,accepted,invited,proposed,hired,rejected},
  published, published_channels[], owner{id,name,avatar_color}, customer{id,name}, created_at }`.
- `GET /vacancies/{id}` volledige detail: alle velden + `skills[]`, `tags[]`, `description`, `application_settings`,
  `channels[]` (kanaal + published-staat), **gekoppelde sollicitaties** `applications[]`
  (`{ id, candidate{id,name,initials}, phase{value,label,color}, source, owner, created_at }`), `leads_count`,
  `custom_fields[]`, `documents[]`, `timeline[]`, `notes[]`, `owner`, `customer`.
- `POST /vacancies`, `PATCH /vacancies/{id}`.
- **Soft-delete** (`deleted_at`): preflight op **actieve gekoppelde sollicitaties/matches** → weiger + lever de
  lijst (overzetten/herverdelen-pad), zoals C-21. Hard-delete alleen als er niets hangt (API-enforced).
- `GET /vacancies/stats` (server-breed, honoreert de filters; zelfde shape-conventie als `/candidates/stats`):
  `by_status[]`, `by_owner[]`, `by_customer[]`, **`by_phase[]`** over de gekoppelde sollicitaties = de KPI-cards
  (`applied/accepted/invited/proposed/hired/rejected`), plus `total`.

**3. Bulk (zelfde contract als C-15 — respond met `updated`/`skipped`/`archived` arrays).**
`POST /vacancies/bulk/owner` (`owner_id`), `…/status` (`status`), `…/customer` (`customer_id`),
`…/publish` (`published` + optioneel `channels[]`), `…/tags/remove` (`tag`), `…/notes` (`text`), `…/archive`.
Autorisatie server-side hercheckt (delete-perm voor archive).

**4. Lookups (tenant-scoped, geseed, in-use-protected → 409, reorderable — zoals C-1/C-7/C-14).**
Bestaand: `/vacancy-statuses`, `/vacancy-phases`, `/vacancy-custom-fields`. Nieuw:
`/vacancy-employment-types` (seed Tijdelijk·Vast·Oproep·ZZP·Uitzend), `/vacancy-seniority-levels`
(seed Starter·Medior·Professional·Senior), `/vacancy-education-levels` (seed VMBO·MBO·HBO·WO),
`/vacancy-channels` (seed Carrière-pagina·Google Jobs·Indeed·Werkzoeken — `key,label,icon?,active`).

**5. Koppeling sollicitaties↔kandidaten (cruciaal — voedt de KPI's én de Sollicitaties-tab).**
Elke sollicitatie verwijst naar een **bestaande geseede kandidaat** (candidate UUID, **niet** SM `external_id`)
+ een vacature + een funnel-fase. Hergebruik de bestaande `applications`-tabel (C-20); vacature-detail levert
`applications[]` en `applications_by_phase`. Zo zijn `applications_count` en de KPI-fasecounts **echt**.

**6. Seeder — 30 dummy-vacatures, voor BEIDE tenants (Demo én Yesway).** Seed de 30 vacatures + lookups in
**zowel de Demo-tenant als de Yesway-tenant** (tenant-scoped, zelfde opzet per tenant). Gevarieerde
status/eigenaar/klant/branche/functie/dienstverband; elk 0–N sollicitaties verdeeld over de fases, **gekoppeld
aan een paar bestaande kandidaten van diezelfde tenant** (candidate UUID — een representatieve subset, niet
elke kandidaat, zodat de koppeling zichtbaar is). Randomiseer `leads_count` + publicatiestaat (kanalen aan/uit)
zodat KPI's, donuts én de conversieratio (applied→hired) meteen testen. Geen PII in logs.

Hangt samen met **E2 (V1–V7)**, **C-19/C-20** (matches/applications), **C-7/C-14** (industries/functions),
**C-1/C-15** (lookups in-use + bulk-contract), **C-6** (gestructureerde locatievelden), **B-18** (applications-refactor).

---

### ☐ C-27 · Klanten (customers) — endpoints + sub-entiteiten + lookups + planning-samenvatting + seeder  *(NIEUW — voedt E4 + B-Klanten-refactor)*
**Doel:** de Klanten-feature voeden met **echte** data zodat de frontend (candidate-blueprint) lijst, KPI's,
filters, bulk én de rijke tab-drawer (Overzicht · Locaties · Afdelingen · Contactpersonen · Vacatures · Kansen ·
Planning · Statistieken) op de API draaien — **geen frontend-dummy meer** (de oude `DUMMY_CUSTOMERS` vervalt).
Tenant-scoped, AVG / special-category. Engels in code, `snake_case` in de API. Lijst = bare array of `{data,meta}`,
detail = bare object of `{data}`. Spiegelt qua aanpak C-26 (tabel + endpoints + bulk + lookups + seeder) en bouwt
voort op C-6 (gestructureerde locatievelden) + C-17 (sub-entiteit-endpoints al hernoemd).

**1. Tabellen — vouw ÁLLES in de bestaande `create_*`-migraties (géén `add_*`/`alter_*`).**
- `customers`: `id (uuid)`, `tenant_id`, `name (req)`, `debtor_number (string, null)`, `status_id (FK customer_statuses)`,
  `owner_id (users — account manager)`, `industry_id (FK industries, null)`, `website (null)`, `employee_count (int, null)`,
  `tone_of_voice (null)`, `description (text, null)`, `recruitment_problems (text, null)`, `privacy_policy_url (null)`,
  `hide_company_name (bool)`, `has_career_page (bool)`, `show_in_my_vacancies (bool)`, `exclude_from_sourcing (bool)`,
  `tags` (json/relatie), `city` (afgeleid van hoofdlocatie of eigen kolom), soft-deletes, timestamps.
- `locations` (C-6): hangt aan `customer_id`; velden `name (req)`, `street, house_number, house_number_suffix,
  postal_code, city, country, coc_number (KvK), vat_number (BTW), contact_name, phone, email (nullable|email)`, timestamps.
- `departments`: **genest onder een locatie** → `location_id (FK locations, req)` (+ afgeleid `customer_id`), `name (req)`,
  `description (null)`, timestamps.
- `contacts`: `customer_id (req)`, optioneel `location_id`/`department_id`, `name (req)`, `function/role (null)`,
  `email (nullable|email)`, `phone (null)`, `is_primary (bool)`, timestamps.

**2. Endpoints (native, clean naming, geen prefix).**
- `GET /customers` paginated, server-filters: `search, status[], owner_id[], city[], industry[]`. GET-rij die de
  frontend leest: `{ id, name, debtor_number, status{value,label,color}, owner{id,name,avatar_color}, city,
  industry{id,name}, locations_count, departments_count, contacts_count, open_vacancies_count, created_at }`.
- `GET /customers/{id}` volledige detail: alle velden + `tags[]`, `description`, `recruitment_problems`, toggles,
  `owner`, `status`, `industry`, en de sub-entiteit-counts; sub-entiteiten zelf via aparte calls (zie hieronder).
- `POST /customers`, `PATCH /customers/{id}`.
- **Soft-delete** (`deleted_at`): preflight op **actieve gekoppelde objecten** (lopende vacatures/matches/plaatsingen)
  → weiger + lever de lijst (overzetten/herverdelen-pad), zoals C-21/C-26. Hard-delete alleen als er niets hangt (API-enforced).
- `GET /customers/stats` (server-breed, honoreert de filters; zelfde shape-conventie als `/candidates/stats`):
  `by_status[]`, `by_owner[]`, plus totals `locations`, `departments`, `contacts`, `open_vacancies`,
  `active_matches` (nu aan werk), `without_contact` (klanten zonder contactpersoon), en `total`.
- **Sub-entiteiten** (bestaan al via C-17 — nu volledige velden + CRUD):
  `GET/POST /customers/{id}/locations`, `GET/POST /customers/{id}/departments` (req `location_id`),
  `GET/POST /customers/{id}/contacts`, elk met `PATCH`/`DELETE /{subId}`. Locaties leveren álle C-6-velden;
  afdelingen leveren `location_id` + `location_name`; contacten leveren functie/e-mail/telefoon + optionele koppeling.
- **Vacatures van een klant** (voedt VacanciesTab + KansenTab + KPI `open_vacancies`): `GET /vacancies?customer_id={id}`
  (al voorzien in C-26-filters); `status=open` voor de Kansen-tab.

**3. Bulk (zelfde contract als C-15/C-26 — respond met `updated`/`skipped`/`archived` arrays).**
`POST /customers/bulk/owner` (`owner_id`), `…/status` (`status`), `…/tags` (`tag`), `…/tags/remove` (`tag`),
`…/notes` (`text`), `…/archive`. Autorisatie server-side hercheckt (delete-perm voor archive).

**4. Lookups (tenant-scoped, geseed, in-use-protected → 409, reorderable — zoals C-1/C-7/C-14).**
`GET /settings/customer-lookups` → `{ statuses: Item[] }` (`Item = {value,label,color?,order?,active?}`).
Seed `statuses` = **Actief · Prospect · Inactief · Geblokkeerd** (behoud huidige kleuren: groen/blauw/oranje/rood).
Optioneel `tone_of_voice` als kleine lookup (seed Professioneel · Informeel). CRUD + reorder + in-use-409.

**5. Planning-samenvatting (MODULE-GATED — alleen tenants met de Planning-module).**
- `GET /customers/{id}/planning-summary` (+ optioneel `?location_id` / `?department_id`) →
  `{ active_now: int, upcoming: [{ date, shift, department, candidate|null (open) }] }` (lichtgewicht: "nu aan het
  werk" + aankomende diensten, bv. 7 dagen).
- `GET /customers/{id}/open-shifts` (+ optionele scope) → open/onvervulde flex-diensten (voedt de Kansen-tab,
  sectie B). Beide endpoints alleen actief als de tenant `plan` heeft; anders 404/403 → frontend toont nette
  lege staat achter de module-gate.

**6. Seeder — ~15–20 klanten, voor BEIDE tenants (Demo én Yesway).** Per tenant (tenant-scoped, zelfde opzet):
gevarieerde `status/owner/industry/city`; elk met **locaties → geneste afdelingen → contactpersonen** (volledige
velden, realistische zorg-namen zoals de screenshots — Zorgpartners/Rivas etc.); gekoppelde **vacatures** (C-26)
en **matches** (C-19) uit **bestaande geseede kandidaten van diezelfde tenant** (candidate UUID — **niet** SM
`external_id`); en planning-/flex-dienst-dummy (voor planning-tenants) zodat KPI's, donuts, stats én de
planning-/kansen-tabs meteen testen. Randomiseer counts/statussen. Geen PII in logs.

Hangt samen met **E4 (KL1–5)**, **C-6** (locatievelden), **C-17** (sub-entiteit-endpoints), **C-19/C-26**
(matches/vacatures), **C-1/C-7/C-14** (lookup-conventie in-use + reorder), **C-15** (bulk-contract).

### ✅ C-28 · Opportunities (Kansen) — tabel + endpoint + stats + seeder — BACKEND KLAAR (2026-06-22, lezing a)
> Geverifieerd in koiosmatch-api: migratie (`tenant/..._create_opportunities_table`), `Opportunity`/`OpportunityStage`-
> models, `OpportunityResource` (shape = exact wat `data/mapOpportunity.js` leest), `OpportunityController`
> (`index` `{data,meta}` · `stats` `{by_stage,by_owner,total,pipeline_value,avg_value}`) + `OpportunityStageController`
> (CRUD + reorder), routes met `permission:opportunities.view/update`-gating, permissies geseed + aan rollen
> gekoppeld, en `dev:reset` seedt **12 kansen/tenant** (Demo + Yesway). **FE-correctie (2026-06-22):**
> `mapOpportunity` las `stage` plat — backend stuurt `stage:{value,label,color}`; mapping leest nu genest
> (+ regressietest). Lezing (a) gebouwd; (b) blijft open beslissing (zie blok hieronder).
**Doel:** de nieuwe top-level **Kansen**-shell (`pages/opportunities/`, zoals Matches, mét KPI-row) voeden met
**echte** data zodat lijst + KPI's op de API draaien — geen frontend-dummy. Tenant-scoped, AVG. Engels in code,
`snake_case` in de API. Lijst = bare array of `{data,meta}`. Spiegelt qua aanpak C-19 (matches) en C-26 (vacatures).

> **❗ Eerst beslissen (Danny) — wat ÍS een "Kans"?** Twee lezingen, ze leiden tot een ander datamodel:
> **(a) Sales-pijplijn-deal** met een klant (waarde €, fase Lead→Gewonnen) — wat de shell nu aanneemt; óf
> **(b) Recruitment-kans = een te vervullen positie** (open vacature / onvervulde flex-dienst), consistent met
> de **Kansen-tab op de klant** in C-27 (`GET /vacancies?...&status=open` + `/customers/{id}/open-shifts`).
> Bij **(b)** is de top-level pagina een **aggregaat** over die open posities (geen eigen tabel) en moeten de
> frontend-velden/KPI's mee (positie/functie/klant/locatie/#open i.p.v. dealwaarde). **Tot dit besloten is**
> bouwt backend de lichte eigen tabel hieronder (lezing a); de frontend is al 404-tolerant (lege lijst zonder endpoint).

**1. Tabel `opportunities` (lezing a) — vouw ÁLLES in de bestaande `create_opportunities`-migratie (géén `add_*`/`alter_*`).**
`id (uuid)`, `tenant_id`, `title (req)`, `customer_id (FK customers, null)`, `stage_id (FK opportunity_stages, null)`,
`value (decimal, null — verwachte dealwaarde €)`, `currency (string, default 'EUR')`, `owner_id (users, null)`,
`expected_close_at (date, null)`, soft-deletes, timestamps.

**2. Lookup `/opportunity-stages` (tenant-scoped, geseed, in-use-protected → 409, reorderable — zoals C-1/C-7).**
Seed pijplijn-fases met kleur: **Lead · Gekwalificeerd · Voorstel · Onderhandeling · Gewonnen · Verloren**
(`value, label, color, is_won?, is_lost?`). De frontend hardcodet geen fases — alles uit deze lookup.

**3. Endpoints (native, clean naming, geen prefix).**
- `GET /opportunities` (paginated). GET-rij die de frontend leest (zie `data/mapOpportunity.js`):
  `{ id, title|name, customer{id,name}|client_name, stage{value,label,color}|stage_label(+stage_color),
  value (number|null), owner{id,name}|owner_name, created_at|expected_close_at }`.
- `POST /opportunities`, `PATCH /opportunities/{id}`, **soft-delete** (`deleted_at`).
- `GET /opportunities/stats` (server-breed, honoreert filters; zelfde shape-conventie als `/candidates/stats`):
  `by_stage[]`, `by_owner[]`, `total`, **`pipeline_value`** (som van `value`) en **`avg_value`** = de KPI-cards
  (Kansen · Pijplijnwaarde · Gem. waarde). *(Nu leidt de frontend deze pagina-lokaal af uit de rijen; zodra dit
  endpoint er is, schakelt de KPI-row over op server-brede totalen.)*

**4. Seeder — ~12 dummy-kansen, voor BEIDE tenants (Demo én Yesway).** Gevarieerde stage/eigenaar/klant en
`value` (€5k–€80k), een paar zonder waarde, gespreide `expected_close_at`, gekoppeld aan bestaande klanten +
een recruiter van diezelfde tenant, zodat donuts (fase/eigenaar) en de waarde-KPI's meteen testen. Geen PII in logs.

Hangt samen met **C-27** (klant-Kansen-tab — de betekenis-vraag), **C-19** (matches — een gewonnen kans mondt
later uit in een match/plaatsing) en **C-26** (vacatures).

### ☐ C-29 · Aangepaste velden — definities + values-JSON + API (8 entiteiten)  *(NIEUW 2026-06-22 — voedt B-21)*
Generaliseer het vacature-contract (`/vacancy-custom-fields` + `custom_fields`) naar **alle 8 entiteiten**.
Tenant-scoped, in-use-protected (409), reorderable, leeg/demo geseed.
- **Definitie-endpoints** per entiteit (mirror `/vacancy-custom-fields`): `/{entity}-custom-fields`
  GET/POST/PUT `reorder`/DELETE → `{ id, name, position, in_use }`. Entiteiten:
  `customer · location · department · contact · candidate · vacancy(✓) · task · match`.
- **Waarden als JSON** op elke entiteit: kolom `custom_fields` (json), in lijst + detail teruggeven als
  **`custom_fields: [{ id, name, value }]`**; schrijven via de bestaande PATCH van die entiteit
  (`{ custom_fields: [{ id, value }] }`).
- **Externe REST-API:** custom_fields meenemen in de publieke API-resources van die entiteiten (JSON), zodat
  API-klanten ze kunnen lezen/schrijven (scope = die entiteit).
- Bevestig: endpoint-naamgeving + koppeling waarde↔definitie (per `id`, aanbevolen).

### ☐ C-30 · `GET /dashboard` summary-endpoint (KPIs + recents + filterbronnen)  *(NIEUW 2026-06-22 — voedt B-22)*
Eén tenant-scoped endpoint dat het dashboard in **één call** voedt en de dashboard-filters honoreert. Veel
bronnen bestaan al (candidates/stats, opportunities/stats, customers, applications, vacancies) → vooral aggregatie.
- **Response (voorstel):** `{ kpis:{ candidates_total, candidates_new, applications_open, vacancies_active,
  customers_active, leads_pipeline, shifts_planned, messages_sent }, recent:{ candidates[], applications[],
  leads[] }, filters:{ vestigingen[], statuses[] }, charts:{ … zie C-31 } }` — alle counts **filter-afhankelijk**
  (periode/vestiging/status).
- **Ontbrekende feeds bouwen/koppelen:** AI/workflow-runs (recente uitvoeringen), WhatsApp-conversaties (recent),
  geplande-diensten-telling (planning/ShiftManager).
- Params `period|vestiging|status`; geen PII in logs; respecteer module-toegang (whatsapp/ai/planning) — lever
  alleen wat de tenant mag zien. Cross-ref **C-13** (messaging/outreach), **C-18/19/20** (tasks/matches/applications),
  **C-26/27/28** (vacatures/klanten/kansen).

### ☐ C-31 · Dashboard — tijdreeks/verdeling-data voor charts  *(NIEUW 2026-06-22 — voedt B-23)*
Voedt de grafieken op het dashboard (line/area/bar/pie/funnel). Lever onder `GET /dashboard` (of apart
`GET /dashboard/charts`), tenant-scoped, filter-honorerend, `nl-NL`/ISO-week-buckets:
- **Tijdreeks** (`bucket=day|week|month`): nieuwe kandidaten · sollicitaties · plaatsingen/matches per periode →
  line/area. - **Funnel:** sollicitatie-fases (Gesolliciteerd→…→Aangenomen) als counts → funnel/bar.
- **Verdelingen** (pie/donut): kandidaten per status · per recruiter · per bron · per functie/regio.
- **Bar:** plaatsingen per maand · diensten per vestiging. Hergebruik bestaande `*/stats`-aggregaties waar mogelijk.
  Geen PII; alleen counts. Cross-ref **C-9** (candidates/stats veldnamen), **C-22** (intake-rapportage), **C-28** (kansen-stats).

### ☐ C-32 · Afwijzing via workflow — event-trigger + queue + multi-kanaal-bericht  *(NIEUW 2026-06-22 — beslissing Danny)*
**Doel:** de afwijzing van een sollicitatie stuurt **geen** bericht meer vanuit Settings, maar **triggert een workflow**.
De recruiter kiest op de **sollicitatie** een **funnelfase = Afgewezen + een afwijsreden** (lookup); dat genereert een
event; de workflow voert de actie **direct** uit of zet 'm **in een queue**. Frontend-zijde is dit deels al gedaan
(zie onderaan); dit blok is de **backend-opdracht**. Conventies: Engels in code, `snake_case` API, tenant-scoped, AVG.

1. **Domain-event bij afwijzing.** Bij het zetten van funnelfase → *Afgewezen* met reden op een `application`:
   emit `application.rejected` met payload: `application_id`, `candidate_id`, `vacancy_id`, `rejection_reason_id`+label,
   `owner_user_id` (recruiter/eigenaar van de sollicitatie), `tenant_id`, `occurred_at`. **Geen PII in logs.**
2. **Workflow-trigger "run when data is received" (event-trigger).** Naast de bestaande triggers (manual/scheduled/
   webhook/mail-hook) een **event-subscription-trigger**: een workflow kan zich abonneren op een entiteit+event
   (`application.rejected`, filterbaar op `rejection_reason_id`/`funnel_stage`) en draait **direct** bij binnenkomst.
   Lever de lijst beschikbare events + filtervelden via een endpoint (bijv. `GET /workflow-events`) zodat de canvas ze toont.
3. **`GET /applicants` (of `/applications`) met filter** — voedt de nieuwe FE-modules `applicants_fetch` + `applicant_filter`:
   filter op `funnel_stage` (incl. `afgewezen`), `rejection_reason`, `vacancy`, `limit`, `order_by`. Voor de
   **scheduled/batch**-variant (inhaalslag) naast de event-trigger. Tenant-scoped, alleen velden die de workflow nodig heeft.
4. **Uitvoering: direct of queue.** Actie direct draaien óf op een **queue met rate-limit** (spiegel de HelloFlex-bulk-aanpak,
   §3A) — robuust bij veel afwijzingen tegelijk; retries + foutstatus per item.
5. **Multi-kanaal-bericht (de "template voor de klant").** De send-actie laat de tenant een **kanaal** kiezen:
   **e-mail · WhatsApp zakelijk (Business API) · WhatsApp privé**. Bij **WhatsApp privé** is de afzender het
   **persoonlijke WhatsApp Web-nummer van de eigenaar van de sollicitatie** (de gekoppelde gateway, zie memory
   `project_whatsapp_web_personal`) — backend moet het juiste `owner_user_id` → gekoppelde gateway-sessie/nummer resolven
   en blokkeren met reden als de eigenaar geen gekoppeld nummer heeft.
6. **Dynamische tekst (tokens).** Berichttekst is een template met placeholders, server-side gerenderd:
   `{kandidaat.voornaam}`, `{kandidaat.achternaam}`, `{afwijsreden}`, `{vacature.titel}`, `{recruiter.naam}` e.d.
   Lever de **beschikbare tokens** per event uit (zodat de FE ze kan tonen/invoegen). Onbekende token = leeg, nooit crashen.
7. **Seed.** Per tenant een **default afwijs-workflow** klaarzetten (event-trigger `application.rejected` → send-actie met
   kanaalkeuze + standaardtekst per locale), zodat de klant 'm alleen hoeft aan te zetten/aan te passen.
8. **Lookups blijven.** `rejection_reason` blijft een tenant-lookup met in-use-409 (`/candidate-rejection-reasons`), maar is
   nu een **sollicitatie-eigenschap** (FE verplaatst naar Settings → **Sollicitaties**). Funnelfasen idem (al in **C-10**).

**[FE] gedaan (2026-06-22):** Settings-groep **Sollicitaties** (Funnelfasen + Afwijsredenen), `RejectionTemplates`-blok
verwijderd uit Settings, en de workflow-canvas-modules: `applicants_fetch` + `applicant_filter` (data, filter op funnelfase),
`applicant_event` (trigger — gebeurtenis + afwijsreden-filter + run_mode direct/wachtrij = "run when data received") en
`applicant_message` (kanaalkeuze e-mail/WA-zakelijk/**WA-privé (nummer eigenaar)** + dynamische tekst met tokens + throttle).
**[FE] nog open (wacht op backend-contract):** de modules met **echte data** voeden — afwijsreden-opties uit de lookup
i.p.v. vrij tekstveld (module-schema's ondersteunen nu nog geen dynamische lookup-selects), de beschikbare **tokens** per event
tonen/invoegen, en de event-lijst uit `GET /workflow-events`. Cross-ref **C-10** (status/funnel), **B-18** (sollicitaties-feature),
`project_whatsapp_web_personal`.

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
- ◐ [FE+BE] **Feature-refactor naar de candidate-blueprint** — monoliet `VacanciesPage.jsx` (739 r, inline
  dummy + hardcoded NL) vervangen door losse, modulaire componenten in `pages/vacancies/` (Page/Table/BulkBar/
  AddModal/Drawer + drawer-tabs + `data/mapVacancy`), settings-gedreven lookups, status-tabbladen, InsightsRow,
  bulk. Frontend = **B-19**, backend = **C-26** (API + seeder, geen frontend-dummy). *(V1, N15)*
- ☐ [FE] Vacatureweergave **zoals Jaicob (JC)** — concurrent-ATS als referentie. *(V1)*
- ☐ [FE+BE] KPI's op de vacature. *(V2 — uit `GET /vacancies/stats`, zie C-23)*
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
- ◐ [FE GEBOUWD] **Klanten herbouwd naar candidate-blueprint** (2026-06-21). Thin `CustomersPage` (gedeelde
  `InsightsRow`: Status+Accountmanager-donuts + 6 KPI's, rechter-filters, bulk-acties, paginatie) +
  `CustomersTable` (lookup-statussen) + thin `CustomerDrawer` met tabs **Overzicht · Locaties · Afdelingen ·
  Contactpersonen · Vacatures · Kansen · Planning · Statistieken · Documenten · Notities**. **Locaties/afdelingen/
  contactpersonen** = eigen subtabs met DataTable + zoeken + rij-klik → rijk detail (locatie: C-6-adres + geneste
  afdelingen + contacten + planning; afdeling: info + contacten + planning; contact: volledige velden). Afdelingen
  **genest onder locatie**. Niets hardcoded (`useCustomerLookups`/`useUsers`/`useIndustries`), i18n ×5, Settings →
  **Klanten → Statussen**. Draait op de API (geen dummy). Hangt op **C-27**. *(KL1–4, N15, N16, zie C-6/C-27)*
- ☐ [FE] Bekijken/koppelen **ShiftManager (SM)** + **HelloFlex**. *(KL5 — follow-up)*
- ☐ [FE+BE] **Besloten:** locaties/afdelingen/contactpersonen **uit de sidebar**, onder de klant nesten
  met (sub)tabs — wél veel méér informatie per onderdeel. ✅ FE gebouwd; BE = C-27. *(N16, KL2–4)*

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

### E12 · Kandidaten — DIEPE AUDIT + VISIE (2026-06-22, brain-dump Danny)

> Danny: "de kandidaten zijn nog lang niet klaar". Alles **API-based, dynamisch, modulair, uitbreidbaar**;
> alles is **aan elkaar gelinkt** (kandidaat ↔ sollicitatie ↔ match ↔ vacature ↔ klant ↔ taken ↔ workflows
> ↔ Koios AI). KOIOS MATCH = de slimste ATS, geen data-entry. Tags: [FE] [BE] [WF] [AI] [SET] [D].

**12.1 · Status-model herzien (uitbreiden + repareren)**
- ☐ [D+FE+BE] **"Geplaatst" → hernoemen naar "Gematched"** (`placed` → `matched`). Overal: seed, mapper, UI, automation.
- ✅ [D] **Statusset BEVESTIGD (besl. 16):** lifecycle = `lead` · `candidate` · `matched` (Gematched) ·
  `inactive` · `unplaceable` (Niet bemiddelbaar, + datum "weer beschikbaar"). **Blacklist = aparte vlag**;
  **Gearchiveerd = soft-delete** (`deleted_at`). FE-seed al gelijkgetrokken; backend = C-10 herseed.
- ☐ [SET+BE] **Alles instelbaar** in Settings (labels/kleuren/volgorde + per-status vlaggen, zie 12.2).
- ✅ [FE] **Aanmaken-modal** — GEBOUWD: alleen **instroom-statussen** kiesbaar (`CREATE_STATUSES=['lead','candidate']`,
  Lead default; defensieve fallback naar alle tot de reseed) + **adresvelden** (straat/huisnr/toevoeging/postcode)
  in de popup, i18n ×5. *(K: "nieuwe kandidaat ook gelijk inactief niet logisch" + "adres erbij")*
- ☐ [FE+BE] **Inactief-guard:** mag alléén als er **geen actieve Match** is **én** (bij Planning-module) de
  kandidaat **niet meer ingepland** staat. Anders blokkeren + nette melding. **Reden verplicht** (besl. 15).
- ☐ [FE+BE] **`unplaceable` (Niet bemiddelbaar/beschikbaar):** verplicht **datum_tot** ("weer beschikbaar op")
  + reden → voedt de heractiverings-workflow (12.6). Op die datum status terug naar Kandidaat (automation).
- ☐ [FE+BE] **Blacklist + Inactief + Archived staan standaard UIT in de filters**, maar **wél doorzoekbaar**
  (expliciet aanvinken). KPI-row telt ze dan ook niet mee → tellingen lager (12.4).
- ☐ [D] **Handmatig status op Gematched zetten — wat dan?** Voorstel: vraag om een vacature/match te
  koppelen (anders inconsistent → vlag), want `matched` zonder Match is een datafout. Te bevestigen.
- ☐ [BE] **Seeder:** zet een paar demo/Yesway-kandidaten op inactive/unplaceable/blacklist/archived zodat
  de filters + KPI's te testen zijn.

**12.2 · Status ↔ sollicitatie ↔ Match-koppeling (per-status vlaggen, instelbaar)**
- ☐ [SET+BE] **Eén** sollicitatie-funnelfase krijgt een vinkje **"maak een Match"** (max 1 fase). Bij bereiken →
  automation maakt een **Match** (+ evt. zet kandidaat-status `matched`). *(zie 12.2 + 12.6)*
- ☐ [SET+BE] **Afwijs-fase** krijgt een vinkje **"verstuur afwijzing"** → kanaal (e-mail / WhatsApp privé /
  WhatsApp Business) + **template-keuze** + keuze **alleen afwijsreden** of **ook vrije tekst**. *(WF-template, 12.6)*
- ☐ [WF+BE] **Match → werkervaring:** bij een Match automatisch een **werkervaring** bovenaan toevoegen
  (klant/functie/periode), via een **workflow-template** (klant aan/uit). *(K: "Match → werkervaring bovenaan")*
- ✅ [FE] **Sortering nieuwste boven** voor werkervaring/opleidingen/certificeringen — GEBOUWD in `mapCandidate`
  (`byNewest`; lopend = bovenaan; onparseerbare dummy-datums behouden volgorde). Werkt ook in de CV.

**12.3 · Filters & alles-zoeker**
- ☐ [FE] **Sidebar-filtermenu gelijktrekken** met het nieuwe status/funnel-model (loop alle filters na;
  default-uit voor inactive/blacklist/archived; funnel = per sollicitatie).
- ☐ [FE+BE] **Alles-zoeker** doorzoekt **álles**: naam · telefoon · e-mail · functie · werkervaring · tags ·
  plaats · … (backend full-text/`q`). **Geldt voor álle pagina's** (kandidaten, klanten, vacatures, taken, matches).
- ☐ [BE] **GEO/LAT-LON** op kandidaat (+ klant/vacature): geocode adres → coördinaten (OpenStreetMap, besl. 6).
  **Vraag aan backend-Claude: bouwen.** Voedt de **straal-filter** (bv. 35 km rond Den Haag).
- ☐ [FE+BE] **Straal-filter** (radius km): bij zware radius-zoek → melding "high-performance zoekopdracht +
  let op kosten" + advies **"maak/voeg toe aan talentenpool"** (besl. 6); rate-limit + caching backend.

**12.4 · KPI-row = filter-gedreven (testen)**
- ☐ [FE+BE] Alle KPI-/donut-tellingen volgen de actieve filters; met inactive/blacklist standaard uit moeten de
  totalen **lager** zijn. **Testen** (zodra 12.1-seeder draait). `stats.attention` respecteert dezelfde scope.

**12.5 · Drawer / tabs / velden / changelog**
- ◐ [FE+BE] **Changelog-tab op de kandidaat** — FE GEBOUWD: `ChangelogTab` (nieuwe drawer-tab "Wijzigingslog")
  leest `GET /candidates/{id}/activity` met loading/error/empty/success (404 = nette lege staat), i18n ×5.
  **Wacht op backend C-16** voor de data (wie/wat/wanneer: status/funnel/consent/velden/matches).
- ✅ [FE] **last-contact-type-kolom in de TABEL** toegevoegd (`columns.lastContactType`, i18n ×5; leeg = "—",
  drawer toont "nog geen contact"). Label via lookup zodra `/last-contact-types` (C-21) live is.
- ☐ [FE+BE] **Hoe worden `last_contact_at` + `last_contact_type` bijgewerkt?** Definiëren: handmatig (drawer-actie),
  bij verzonden WhatsApp/e-mail (automation), of bij een afgeronde taak. Backend zet de bron.
- ✅ [FE] **Profieltekst = de Notities-editor** — GEBOUWD: `RichTextEditor` (rich) + **HTML-bron-toggle** (`<>`) +
  **vergroten/verkleinen**, lees via `SafeHtml`. HTML-toggle zit in de **gedeelde** component → werkt ook in
  Notities/e-mail. **Rest:** klant- + vacature-profielteksten dezelfde editor geven (zelfde component, nog koppelen).
- ◐ [FE] **Potlood-edit zonder grootte-sprong** — GEBOUWD in `ProfileTab` + gedeelde `EditableFieldTable`
  (lees-waarde reserveert `minHeight: 33` = input-hoogte). Rest: overige edit-blokken nalopen (header/notities).
- ☐ [FE] **Velden in het juiste tabje** + juiste groottes — volledige tab/veld-audit.

**12.6 · Workflows & automation (templates) — het kloppend hart**
- ☐ [WF+SET+BE] **Workflow-TEMPLATES kant-en-klaar** voor klanten (aan/uit), in de juiste folders, gebouwd door
  Workflow-Claude. Vereist: juiste **modules** actief + juiste **filters/selectie** (kandidaten die voldoen).
  Voorbeeld-templates:
  - **Heractivering:** kandidaat `unplaceable`/beschikbaar-datum nadert → **4 weken vooraf WhatsApp** + **auto-taak**
    "benaderen" + op datum status → Kandidaat. *(K: "6 mnd weer beschikbaar → taak + appje")*
  - **Niet-benaderd > X:** maak beltaak voor de recruiter.
  - **Match → werkervaring** (12.2). **Sollicitatie-fase → Match** (12.2). **Afwijzing versturen** (12.2).
  - **Onboarding/eval-taken:** "bel kandidaat", "hoe was eerste werkdag?", "evaluatie" — auto-gegenereerd (12.8).
- ☐ [WF+BE] **Folders bestaan al** (`/workflow-folders` + per-workflow `status` active/draft/inactive = de klant-aan/uit).
  Workflow-Claude **seedt de templates als workflows in vaste folders**; alleen seeden waar de tenant de vereiste
  modules heeft. **Folder-taxonomie (vast):** `📁 Kandidaten` · `📁 Sollicitaties` · `📁 Matches/Plaatsingen` ·
  `📁 Vacatures` · `📁 Taken & opvolging` · `📁 Systeem/Rapportage`.
- ☐ [WF+BE] **Template-contract (per template = één geseede workflow):**
  `{ name, folder, trigger (cron | event | date-relative bv. available_again_date − 28d),
  segment (opgeslagen filter/talentenpool via de candidate_filter-module), steps[]{type,config},
  required_modules[], default_status }`. Bestaande module-types: `candidate_filter` · `shift_fetcher` ·
  `whatsapp_send` (message_type `template`/`flow`) · `email_send` · `database_update`.
- ☐ [WF+BE+FE] **Nieuwe module-types nodig voor deze templates** (backend bouwt + canvas-editor toont):
  `task_create` (taak + subtaken, toewijzing), `status_set` (status/`reason`/`effective_from`),
  `experience_add` (Match→werkervaring bovenaan), `wait`/`delay`, `ai_match` (Koios-voorstellen),
  `condition`/branch. → de `WorkflowCanvasEditor` moet deze types kennen (MODULE_META + config-panel).
- ☐ [FE+BE] **Workflow-monitoring:** zien dat een run **echt gelopen** is (run-logs, status, fouten). *(I13)*
- ☐ [BE+D] **Resilience/edge-cases** (Danny "1000 stappen verder"): gekozen WhatsApp-nummer **down** op runtijd →
  zichtbare fout + kandidaten niet benaderd (queue + retry + alert); **eindgebruiker bestaat niet meer** →
  fallback-afzender/owner; **afzender op vakantie** → van wiens nummer sturen we (per-context afzender, B-1)?
- ☐ [D] **Selectie-vraag:** workflows moeten precies de kandidaten kunnen selecteren die aan een filter voldoen
  (segment = opgeslagen filter/talentenpool). Besluit: workflow-trigger op **opgeslagen segment/pool**.

**12.7 · Koios AI (nachtelijk + matching) [AI]**
- ☐ [AI+BE] **Nachtelijke job:** gewijzigde kandidaten herwaarderen, talentenpools bijwerken, "gewijzigd op" zetten,
  voorgestelde acties (12.5 changelog/advies). *(I25)*
- ☐ [AI+FE+BE] **AI stelt beste kandidaten voor per vacature** (scoring-engine, referentie-CONFIG onderaan E):
  op de **vacature** een tab **"Voorgestelde kandidaten (Koios)"** → daarna **benader-stap** (WhatsApp / e-mail /
  WhatsApp Business) met template. *(M-engine + V-tabs)*
- ☐ [FE+BE] Op de **vacature**: toon kandidaten die **al voor deze klant gewerkt** hebben + hun status (snelle re-hire).

**12.8 · Taken — bulk bellijst + subtaken [FE+BE+WF]**
- ☐ [FE+BE] **Bulk-actie "Taak maken"** op kandidaten → een **bellijst** = één taak met **subtaken** (één per
  kandidaat). **Toewijzen aan meerdere** → automatisch **verdelen**. Elke subtaak afsluitbaar: **succes / failed /
  vervolgactie**. Subtaak voor **jezelf** of voor een **workflow**.
- ☐ [WF+AI] **Auto-gegenereerde taken** (bel-, eerste-werkdag-, evaluatie-taken) via workflow-templates.

**12.9 · Cross-entiteit (klanten / vacatures / matches / taken) — ideeën**
- ☐ [FE] **Tabs-pariteit** (zoals kandidaat-blueprint) op klanten/vacatures/taken/matches (N15). Klant nest
  locaties/afdelingen/contactpersonen (besl. 4).
- ☐ [FE+AI] **Vacature:** Jaicob-achtige weergave (V1) + Koios-voorgestelde kandidaten (12.7) + re-hire-lijst.
- ☐ [AI] **Snel bij de juiste info vanuit elke hoek** via de juiste tabs/logica + Koios AI + pools + workflows.

**12.10 · Bugs / direct (FE)**
- ☐ [FE+BE] **Recruiter-kleur kan niet ingesteld worden** (Danny meldt opnieuw). Audit: FE `setColor` =
  optimistisch `PATCH /users/{id} {avatar_color}` (lijkt correct). **Vermoed backend:** `avatar_color` niet
  fillable/teruggegeven → **C-12 heropenen, verifiëren ingelogd**.
- ☐ [FE] **Tech-debt: hardcoded status-kleurmaps** in de ShiftManager/Rapporten-module (`verwijderd`/`actief`/…
  in `CandidatesReport`, `DrillDownDrawer`, `KpiDrillDownDrawer`, `CandidateDetailDrawer`, `shiftmanager/CustomersPage`).
  Externe `sm_`-rapportage, los van het kandidaat-model — naar lookups/tokens migreren ("niks hardcoded").

**12.11 · Commercieel / ops [D]**
- ☐ [D] **Inrichtings-inschatting** per pakket (modules + workflow-templates + filters): uren + prijs.
- ☐ [D] **Data-migratie** per klant: aparte prijs + proces.

**12.12 · Open beslissingen (Danny) — nodig vóór bouw**
- [D] Statusset definitief (12.1) + namen/kleuren. · [D] Gedrag handmatig `matched` (12.1). ·
  [D] Waar leeft de "weer-beschikbaar-actie": **workflow** (advies) vs settings. · [D] Welke kanalen voor
  afwijzing/benadering default. · [D] Module **Taken** verplicht voor de auto-taken? (ja, lijkt nodig).

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

**9. Settings = eigen top-level menu's met sub-tabjes.** De instelbare lijsten gaan **uit
Personalisation** en worden eigen menu's, elk met sub-tabs: kandidaat-lookups (*Contractvormen ·
Funnelfasen · Statussen*), talen (*Talen · Niveaus*), vacatures (*Statussen · Fasen · Velden*). *(B-16.1)*

**10. Taken-KPI erbij, kaarten compacter.** "Actieve gesprekken" blijft; de Taken-KPI (aan kandidaten
gekoppelde taken) komt er naast → alle KPI-kaarten worden iets kleiner. *(B-16.5, C-21)*

**11. Recruiter-kleur = per gebruiker.** Blijft op **Beheer → Gebruikers** (al gebouwd, B-11/C-12); géén
per-rol-kleur. Persoonsgebonden en granulair. *(B-16)*

**12. Bulk kandidaat-type = multi-select (add/remove).** De type-actie zet de **exacte set** (toevoegen
én verwijderen in één menu) i.p.v. single REPLACE → zo haal je bv. ZZP eraf zodat het type in Settings
verwijderbaar wordt. *(B-16.6)*

**13. Intake = afdwingbare, rapporteerbare funnelfase (geen status).** Een **funnelfase** krijgt in Settings
een checkbox **`requires_appointment`** (zoals `is_applicant`) — klanten benoemen die fase zelf, wij hardcoden
niets. Staat een kandidaat op zo'n fase **zonder geplande afspraak** → inconsistentie-vlag (icoon +
`stats.attention.missing_appointment`), niet hard blokkeren. **Afspraken** worden een gestructureerde entiteit
(`scheduled_at`, recruiter, vestiging, type, status) zodat we **intakes kunnen rapporteren** per
**dag/week/maand × recruiter × vestiging × bron × functie × regio** (`GET /reports/intakes`). "Intake gepland"-KPI
komt voortaan uit geplande afspraken, niet uit `status==='intake'`. *(B-17 + C-22; cross-ref F3.6, V4)*

**14. Drie schone assen + de twee wegen naar een plaatsing (definitief).** Door elkaar halen was de bron
van de rommel. (a) **Kandidaat-type** = contractvorm, **meerdere** (Oproepkracht/ZZP/Payroll/Uitzend/
Detachering) — behouden. (b) **Status** = lifecycle, één waarde, seed **Lead · Kandidaat · Geplaatst ·
Inactief** (Archief = soft-delete-staat, geen status). (c) **Funnel** = pijplijn **per sollicitatie**, seed
**Gesolliciteerd · Uitgenodigd/Intake · Voorgesteld · Aangenomen · Afgewezen**. De oude candidate-`funnel_type`
**prospect/intake/pool/alumni wordt opgeheven** (verdeeld over status/funnel/talentpools). **Status↔funnel =
automatisering** (workflow-regels, per tenant), niet één veld: 1e sollicitatie → Kandidaat; Aangenomen → Match +
Geplaatst; Afgewezen → blijft Kandidaat. **Twee wegen naar een plaatsing** (beide instroom — nieuwe Lead óf
bestaande Kandidaat): via **sollicitatie/funnel** óf een **directe Match** zonder funnel; beide → plaatsing →
Geplaatst. *(B-10 + C-10; FE-seed-fallback al rechtgezet in `LookupsContext.jsx`)*

**15. Status/beschikbaarheid-wijzigingen krijgen datum + reden ("inactief sinds").** Elke status- en
beschikbaarheidswissel legt een **ingangsdatum** (`effective_from`) vast en (bij beschikbaarheid) een
**reden** → toon "Inactief sinds DD-MM-YYYY" / "Niet beschikbaar sinds … · reden". Loopt een match/opdracht
af (bv. 31-05-2026) en werkt de kandidaat niet meer → automatisering zet status **Inactief** met ingangsdatum
= einddatum opdracht. Het "werkt-niet-meer"-signaal raadpleegt later ook de **planning-module**. Backend houdt
een kleine wijzig-log (`effective_from` + `reason`), gekoppeld aan de audit (C-16). *(C-10/C-16 backend;
B-10/B-17 frontend toont 'sinds'-datum + reden bij status/beschikbaarheid)*

**16. Statusmodel = lifecycle + losse vlaggen (2026-06-22).** **Status** (één waarde): `lead` Lead · `candidate`
Kandidaat · `matched` **Gematched** (was Geplaatst) · `inactive` Inactief · `unplaceable` Niet bemiddelbaar
(+ datum "weer beschikbaar"). **Blacklist = aparte vlag** (orthogonaal: Kandidaat kan geblacklist zijn).
**Gearchiveerd = soft-delete** (`deleted_at`), geen status. Inactive/Blacklist/Archived **standaard uit in
filters** (wél doorzoekbaar → KPI-totalen dalen). **Inactief-guard:** alleen als geen actieve Match én (Planning)
niet ingepland; reden verplicht. **Handmatig `matched`** → vraag een Match te koppelen (anders inconsistentie-vlag).
**Automation = workflow-templates** (trigger op opgeslagen segment/talentenpool), niet hardcoded. *(E12; FE-seed-
fallback al gelijkgetrokken in `LookupsContext.jsx`; backend = C-10 herseed + C-0 seeder.)*

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
