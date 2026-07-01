# Koios Match — Werklijst

> **DE ene levende bron.** Alleen open taken. Specs staan in CLAUDE.md §3B of in een C-item hieronder.
> Architectuur-bron = `docs/ARCHITECTURE.md`; regels = `CLAUDE.md`. Verder geen losse worklists meer.
> **Bijgewerkt:** 2026-06-29 — file-by-file audit gefold in §G; zie ook `docs/AUDIT.md` (bewijslast),
> `docs/DATA-API.md` (mock + CRUD-matrix), `docs/DECISIONS.md` (keuzes + SaaS-schaalbaarheid 10→1M).
>
> **2026-06-29 [FE]:** kandidaat-lookups nu volledig uit de API — note-types/document-types/cv-template
> ontkoppeld van hardcode + planning-mock weg; backend moet endpoints + seed leveren → **C-37 / C-38**.
>
> **2026-06-29 [model]:** assen-model **v2** besloten (CLAUDE.md §3B) — "status" splitst in **Fase**
> (Lead/Kandidaat) + **Inzetbaarheid** (Beschikbaar/Geplaatst/Niet beschikbaar/Ziek/Verlof; availability
> erin gevouwen); "Kandidaat type" → **Contractvorm**; blacklist-reden instelbaar. BE → **C-10**, FE → **C-39**.
>
> **Legenda:** ☐ open · ◐ deels klaar · ✅ klaar · 🔴 blokkerend · [D] Danny · [FE] Frontend · [BE] Backend

---

## A. Danny — beslissingen nodig

- [ ] **A-1** [D] Kandidaat drawer hertekenen (plan klaar, sessie 2026-06-24): 6 tabs + subtabs. Goedkeuren?
- [ ] **A-2** [D] "Kans" = sales-deal (lezing a, huidig) of open vacature/positie (lezing b)? Bepaalt het datamodel.
- [x] **A-3** [D] ✅ Besloten 2026-06-29: `Geplaatst` mag handmatig, **maar verplicht een Match koppelen** (geen Geplaatst zonder Match). Zie C-10/C-39.
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

### B-A1.2 · Kandidaat-drawer — consistentie-polish (✅ afgerond 2026-06-29)
Findings uit de volledige drill-down-doorloop. Allemaal FE, geen backend.
- ✅ **Chips uniform met "Kandidaat type".** `EditableFieldTable` toont `branche`/`rijbewijs`/
  `voorkeursdagen` in read-modus nu als zachte chips (i.p.v. komma-tekst). Gekozen: **chips in de
  bestaande Voorkeuren-tabel** (één Save behouden, potlood blijft) — de aparte-kaarten-variant is
  bewust niet gedaan.
- ✅ **Planning-koppen grijs uppercase.** `drawer/constants.ts` `sectionTitle` hergebruikt nu
  `ui/SectionCard.sectionTitle` (één bron) + block-marginBottom voor de bare-span-usage.
- ✅ **Functie-veld → creatable combobox.** Nieuw `creatable`-type in `EditableFieldTable` (wraps
  `CreatableSelect`); Voorkeuren-`function` gebruikt het met `allowCreate = useFunctions().allowFreeEntry`.
- ✅ **Dode code:** ongebruikte `LanguageTab`-export uit `SectionTabs.tsx` verwijderd.
- ✅ **Sleep-handle:** loze `GripVertical` bij ervaring/opleiding verwijderd (reorder was niet bedraad).

### B-1 · E-mail per context
Settings-UI: 4 panelen/tabs, provider-keuze, handtekening-editor, default-fallback. Backend klaar.

### B-2 · Koios AI — verbruik + super admin
- Scherm C: verbruik per gebruiker/type (`GET /ai/koios/usage`)
- Scherm D: super-admin overzicht (`/admin/usage` + `/admin/prompts`)
- Paperclip/upload in de chat
- Hangt op: backend veldnamen bevestigen

### B-3 · Bulk-acties fase 2
- ✅ **Tag toevoegen** (FE-node gebouwd 2026-07-01) → backend `POST /candidates/bulk/tags/add` (`{candidate_ids, tag}` → `{updated}`).
- ✅ **Lead → Kandidaat (Fase, FE-node)** met **X-van-Y-melding** → backend **`POST /candidates/bulk/phase`** (`{candidate_ids, phase}`): valideert per kandidaat tegen `candidate_required_fields[phase]`, **skipt incomplete**, geeft `{updated, skipped}`. FE toont "39 van de 50 gelukt".
- ✅ **Status/Inzetbaarheid (simpele: Beschikbaar/Ziek/Verlof), FE-node** → backend `POST /candidates/bulk/status` (`{candidate_ids, status}` → `{updated}`). Match/reden-gegate statussen (Geplaatst/Niet beschikbaar/Blacklist) bewust NIET in bulk.
- ✅ **Bulk-"type" → "Contractvorm"** label (i18n ×5).
- ☐ Koppelen aan vacature (bulk → maakt sollicitatie, geen auto-e-mail) · Vestiging/branch koppelen — Hangt op C-15.
- **Backend te leveren:** `bulk/phase` (met per-kandidaat verplicht-veld-validatie + `{updated,skipped}`) · `bulk/status` · `bulk/tags/add`.

### B-6 · Webhooks filter-UI
Live testen zodra `/webhook-subscriptions` + `/webhook-events` bestaan (C-5b).

### B-7 · WhatsApp Web (persoonlijk) — live verifiëren
Frontend gebouwd; endpoints wachten op gateway.

### B-28 · WhatsApp-herstructurering — lijst + Wachtrij + Settings (IA besloten 2026-07-01) — ◐ FE Stap 1+2 KLAAR
Splits op **intentie** (bedienen / analyseren / instellen), mirror't de blueprint. Besloten met Danny.
**FE ✅ (2026-07-01):** WhatsApp-pagina = tabs (Overzicht/Berichten/**Wachtrij**/Escalaties) + KPI-InsightsRow bovenaan
(klik = drill-down) + teller-badge op tab én sidebar; **Settings → Berichten → Wachtrij** (rate-limit per nummer +
berichttype-lookup via `StatusListEditor`, order = prioriteit) — i18n ×5. Afgestemd op C-43 (stats per-nummer,
mutaties `messaging.manage`). **Rest:** enqueue-triggers/demo-data om de lijst te vullen; Fase 2 = Rapportage-menu.
- **WhatsApp-pagina → operationele lijst met tabs:** Berichten · **Wachtrij** (privé-outbox) · Escalaties.
  Fase 1 blijft het KPI-dashboard een "Overzicht"-tab; Fase 2 verhuist dat naar een Rapportage-subpagina.
- **Wachtrij-tab** (privé-outbox): kandidaat · berichttype (soft-chip) · prioriteit · status
  (queued/sending/sent/failed/skipped) · poging · gepland; filters + acties (nu-versturen/pauzeren/
  verwijderen/retry — authorization-gated) + rate-limit-teller. Hoort bij **WhatsApp** — niet Workflow
  (dat is ontwerp), niet Rapportage (dat is analytics). Kleine "→ bekijk wachtrij"-link vanaf de
  `applicant_event (in wachtrij)`-node.
- **Settings → WhatsApp:** berichttype-lookup (classificatie, CRUD+reorder+kleur; seed sollicitatie/match/
  herinnering/algemeen/verjaardag/marketing) + prioriteitsvolgorde (= sleepvolgorde) + rate-limit per nummer.
  Niks hardcoded; seed-fallback bij 404 (mirror `useGenders`/`useFunctions`).
- Hangt op **C-43** (queue-contract). Fase 1 = tabs + Wachtrij + Settings; Fase 2 = Rapportage-menu.

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

### B-21 · Aangepaste velden + verplichte velden + duplicate-check/merge (kandidaat eerst) [FE]
Uitgebreid plan 2026-06-29 (leunt op v2-assen C-39 voor "verplicht per fase"). Hangt op: C-29.
- ☐ **Eigen velden — Settings-editor:** `CustomFieldsEditor` (key/label/**type**/options/order/active/
  `required_for[]`/`label_i18n`). Types: text·number·date·select·boolean·textarea. **Type op slot bij
  data** (slotje + tooltip). Verwijderen geblokkeerd bij gebruik (409 + `in_use`).
- ☐ **Extra-tab in de drawer:** alleen tonen bij ≥1 actief eigen veld (zoals conditionele tabs);
  rendert via `EditableFieldTable` (typen bestaan al). Waarden = `custom_fields {key:value}`-JSON.
- ☐ **Verplichte velden per fase (Lead vs Kandidaat):** ster (\*) + inline-melding + **opslaan
  geblokkeerd** bij leeg; fase-afhankelijke set; promotie Lead→Kandidaat preflight ("vul eerst …").
  Geldt voor ingebouwde én eigen velden.
- ☐ **Duplicate-check:** live pre-check (`GET /candidates/check-duplicate`, debounced op email/mobile)
  + 409-afvang op create → melding "Kandidaat of lead bestaat al" + link naar bestaand record.
  Sleutels instelbaar (`candidate_dedupe_keys`, default email+mobile).
- ☐ **Merge:** modal met **slimme voorinvulling** (per veld voorstel: niet-lege / nieuwste waarde wint,
  overrulebaar) → `POST /candidates/{survivor}/merge`; sub-entiteiten omhangen, bron soft-delete/
  anonimiseer. Trigger vanuit duplicate-melding of bulk-select.
- ☐ **Kleur-toggles meenemen:** custom-veld-kolommen **opt-in per veld** (`show_in_table`-vlag) met
  eigen toon-toggle; nieuwe v2-kolommen (Fase·Inzetbaarheid·Contractvorm) krijgen kleur-per-kolom-toggle
  (candidateDisplay).
- **Besloten 2026-06-29 (Danny):** (1) labels = **hoofdlabel + optionele vertalingen** per taal
  (`label_i18n`, leeg = fallback op hoofdlabel); (2) merge = **modal met slimme voorinvulling**
  (overrulebaar), géén volautomatische merge; (3) eigen velden **opt-in als tabel-kolom**
  (`show_in_table`-vlag), standaard alleen in de Extra-tab.

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

### B-30 · Design-coherence sweep — chips/toggles/typografie over alle entiteiten
Standaard staat nu in **CLAUDE.md §4** (soft-chip/toggle-conventie: altijd getint in de eigen
semantische kleur via `color-mix`, nooit solide fill, subtiel inactief + sterker/vet actief;
typografie: gewichten 400–500/600–700, bold=nadruk/actief, italic=alleen secundair, kleur alleen
via tokens). Referentie = de Blacklist/Archived quick-view-knoppen in `CandidatesPage.tsx`.
**Doel:** trek chips/pills/toggles + typografie consistent over candidates · applications ·
vacancies · matches · opportunities · tasks · call-lists · customers + SM-rapporttabellen.
**Incl. i18n-check:** geen ruwe sleutels in de UI (zoals eerder `page.blacklistView`); elke
knop/label heeft een key in álle 5 locales. Kopieer je dezelfde color-mix-styling >2× → extraheer
een gedeelde helper. Kopieer-klare prompt hieronder.

```text
Je bent frontend-Claude voor KOIOS MATCH. Doe een DESIGN-COHERENCE SWEEP: trek de visuele stijl
van chips/pills/toggle-knoppen én typografie consistent over ALLE entiteiten.

BRON: CLAUDE.md §4 (soft-chip/toggle + typografie) + referentie in CandidatesPage.tsx
(Blacklist/Archived quick-view-knoppen).

STANDAARD:
- Chips/pills/quick-view-toggles ALTIJD getint in eigen semantische kleur, NOOIT solide fill.
  background = color-mix(in srgb, <token> 8–16%, transparent) (lager inactief, hoger actief);
  tekst + icoon = <token>; border = color-mix(… 28–50%). Inactief houdt z'n kleur (subtiel, niet
  grijs); actief = sterkere tint + fontWeight 600. color-mix zodat CSS-var-tokens ook werken.
- Typografie: Inter (UI), JetBrains Mono (getallen/IDs). 400–500 body/labels, 600–700 actief/titels,
  nooit zwaarder. Bold = nadruk/actief only. Italic = alleen secundair/placeholder/empty-state,
  NOOIT voor data. Kleur alleen via tokens, geen ad-hoc hex.

ENTITEITEN (elk Page + Drawer + BulkBar + chips/badges): candidates (ref) · applications ·
vacancies · matches · opportunities · tasks · call-lists · customers + SM-rapporttabellen.

PER ENTITEIT: (1) toggle/quick-view-knoppen → conventie; (2) status/fase/type-chips + badges →
zelfde tint (geen solide fills, geen grijs); (3) typografie gelijktrekken; (4) i18n-check: geen
ruwe sleutels, elke key in nl/en/de/fr/es; (5) hergebruik gedeelde componenten, extraheer een
helper bij >2× dezelfde styling.

REGELS: TypeScript, één EN-comment/blok, lint schoon, geen bestand >1000 regels. Coördineer via
worktree-per-lane (COORD-1); git status vóór elke edit; raak geen WIP-files van andere lanes aan.
LEVER: consistente chips/knoppen/typografie + lijst toegevoegde i18n-keys + geëxtraheerde helpers.
```

### B-31 · Entity-drawer consistentie-sweep (vacature/klant/locatie ↔ kandidaat-blueprint) — review 2026-07-01
> Danny reviewde de **vacature-drawer** naast de **kandidaat-drawer**. De kandidaat-drawer is de
> canonieke referentie (§3A/§3B) — elke afwijking hieronder gelijktrekken. Vacatures = lane A1.

**FE — vacature-drawer gelijktrekken aan kandidaat:**
- [ ] **Locatie-format**: zelfde adres-/locatieweergave als in de kandidaat drill-down (`lib/formatters`,
      DD-MM-YYYY + adresopmaak). Nu inconsistent.
- [ ] **Vereiste vaardigheden**: exact de skills-UI van de kandidaat (verticale lijst, edit/remove per rij,
      lookup — geen inline chips). Hergebruik dezelfde component.
- [ ] **Titel + omschrijving**: via de gedeelde `RichTextEditor` (de notities-editor), zoals bij de kandidaat.
- [ ] **Documenten**: read-only + snelle weergave (preview-modal) **zoals kandidaat**; toon **door wie + wanneer**
      toegevoegd. Zelfde `DocumentsSection`-patroon.
- [ ] **Notities**: identiek aan de kandidaat (potlood→diskette, nieuw=diskette/✕) **+ notitie-soorten** (lookup)
      **+ door wie/wanneer**. Zelfde `NotesTab`/composer.
- [ ] **Changelog-icon** in de title-row bovenin (mist nu in de vacature-drawer; kandidaat heeft `ChangelogPopover`).
- [ ] **Adres overnemen bij klant/locatie-keuze**: kiest de gebruiker een klant en/of locatie → **prompt**
      "adres van klant/locatie overnemen of zelf kiezen?" (i.p.v. stil overschrijven).
- [ ] **Afspraken** (intake-gated stages, §3B): **type instelbaar** (lookup), **datum+tijd van–tot**, **locatie**.
- [ ] **Statistieken-tab**: documenteer/toon de **bron** van "alle kandidaten" (server-wide `/…/stats` vs. geladen
      pagina) zodat de teller niet verwarrend is — zelfde bronregel als de kandidaat-KPI's.

**FE — cross-cutting (óók kandidaat + overal, MIJN lane deels):**
- [ ] **Audit-metadata "door wie + wanneer"** op **notities én documenten** overal tonen (kandidaat eerst).
      Hangt op backend-velden (zie C-hieronder).
- [ ] **Klanten + locaties**: adres-weergave nakijken op consistent format (zelfde `lib/formatters`).

**BE — nodig hiervoor:**
- [ ] Notities: `created_by` (user) + `created_at` in de API-respons; **note-types** lookup (`/note-types`, CRUD +
      seed + in-use 409) — zie ook C-1.
- [ ] Documenten: `uploaded_by` + `uploaded_at` in `documents[]` (kandidaat + vacature + overal).
- [ ] **Afspraak-type** lookup (instelbaar) + afspraak-velden `scheduled_from`/`scheduled_to`/`location`.
- [ ] **Matching-profiel** (vereiste vaardigheden/criteria): **instelbaar in Settings**, per vacature **overgenomen**
      en **afwijkbaar** — endpoint + per-vacancy override + seed. (Danny-vraag: waar leeft het profiel → Settings-default
      + per-vacature override.)

**✅ Gedaan in deze review:** tiptap dubbele `underline`-extensie verwijderd (`RichTextEditor.tsx`) — de
`Duplicate extension names found: ['underline']`-warning is weg.

---

## C. Backend — open taken

### 🔴 C-0 · Volledige seeder (Yesway + demo)
Alle lookups + realistische sample-data voor beide tenants. Geen lege schermen meer.

### 🔴 C-10 · Assen-model v2 — reseed + endpoints (HERZIEN 2026-06-29, vervangt oude reseed)
> **Uitvoering in 2 golven (BE-Claude, 2026-06-30 — niet interleaven met live WIP):**
> **Golf ① (veilig/additief, nu):** `candidate_phases`-tabel + `CandidatePhase`-model + de 3
> toevoegingen in de bestaande `CandidateLookupController` + seed (`lead`/`candidate`) + additieve
> `phase`-kolom (default `lead`). Levert FE `phases:[]` + de nieuwe as; **raakt status/availability/
> guards/TemplateLibrary niet**.
> **Golf ② (brekend, gecoördineerd window):** status→inzetbaarheid reseed + flags + **availability
> eruit** + guards/transitions + de hardcoded status-waarden in **TemplateLibrary**. Collega commit
> TemplateLibrary eerst; daarna landt de flip als **één** wijziging (collega: guards + TemplateLibrary;
> BE-Claude: schema/lookup/seeder). **FE-availability-refs opruimen hoort in ditzelfde window.**

Besluit 2026-06-29 (CLAUDE.md §3B v2): de overladen "status"-as **splitst** in **Fase** (lifecycle)
+ **Inzetbaarheid** (operationeel). Backend moet hiervoor **migraties (gevouwen in `create_*`),
modellen, seeders én API's** bijwerken. Waardenmatrix:
- **Fase** (`phases`, NIEUWE lookup-tabel + endpoint `/settings/candidate-lookups/phases`):
  seed `lead · candidate` (+ later `alumni`). Lead→candidate-automation (1e sollicitatie/intake).
- **Inzetbaarheid** (de bestaande `statuses`-lookup **herzien** + de losse `availability` erin vouwen):
  seed `available · placed · unavailable · sick · leave`. **`placed` vereist een gekoppelde Match**
  (handmatig zetten → verplicht Match; auto via funnel `hired`→Match). `unavailable` = met
  weer-beschikbaar-datum + reden. Endpoint `/settings/candidate-lookups/statuses` (of hernoemen).
- **Blacklist** *(herzien 2026-06-30)* = **een status-waarde** in `candidate_statuses` (seed `blacklist`
  met vlag `requires_reason`), **géén aparte kolom/vlag** meer. Reden loopt via de status-reden
  (change-log `status_reason`). De `blacklist_reason_required`-key + losse `blacklisted`-kolom vervallen.
- **Archived** = soft-delete (`deleted_at`), geen status.
- **Contractvorm** = de bestaande `candidate-types`-lookup; **alleen het FE-label** wijzigt
  (Kandidaat type → Contractvorm), **waarde-keys ongewijzigd** — backend hoeft niets te hernoemen.
- **Migratie bestaande data:** `matched`→`placed`; `inactive`/`unplaceable`→`unavailable` (met reden);
  oude `availability`-waarden → de nieuwe inzetbaarheid-as; `lead`/`candidate` → de nieuwe `phases`-as.
- **Changelog:** fase- én inzetbaarheid-transities met `effective_from` + reason (sluit op C-16 aan).

### C-39 · Frontend — assen-model v2 doorvoeren (◐ FE-first gebouwd 2026-06-29, seed-fallback)
**Gebouwd (FE-first, draait op seed tot C-10 backend levert):**
- ✅ `LookupsContext`: `phases` (Lead/Kandidaat) + `phaseMeta` + `/settings/candidate-lookups`-wiring;
  `statuses` herzien naar **inzetbaarheid** (Beschikbaar/Geplaatst/Niet beschikbaar/Ziek/Verlof).
- ✅ `mapCandidate`-**shim**: splitst legacy `status` (lifecycle) in `phase` + deployability zodat
  bestaande data blijft renderen; expliciete `c.phase`/`c.deployability` winnen.
- ✅ Drawer-header: **Fase-picker + Inzetbaarheid-picker**; `Geplaatst` zonder Match → **prompt-modal**
  (informeert + blokkeert; match-creatie zelf is backend).
- ✅ Tabel: kolommen **Fase · Inzetbaarheid · Contractvorm** + kleur-per-kolom-toggles
  (`candidate_table_color_phase` toegevoegd).
- ✅ AddCandidateModal: linkerpaneel kiest nu **Fase** (Lead/Kandidaat); deployability default `available`.
- ✅ Settings: **Fase**-sub-tab + statuses-tab (label "Status") + Contractvorm-label; i18n ×5.
- ✅ **Status-editor-vlaggen:** `requires_match` + `expects_return_date` (naast `requires_reason`).
- ✅ **Verplichte velden**-sub-tab: matrix veld × fase → `candidate_required_fields` (`/settings`).
- ✅ **Blacklist = status-waarde** (herzien 2026-06-30): geen aparte knop meer; `blacklist` is een
  status met `requires_reason` → de status-reden-popup vraagt de reden; rode chip. Losse
  blacklist-knop/modal + `blacklisted`-velden verwijderd.
- ✅ **Status-popups** (flag-gedreven): Geplaatst→Match vereist; Niet beschikbaar/Ziek/Verlof→**reden +
  "weer beschikbaar vanaf"-datum** (stuurt `status_reason`/`status_return_date` mee).
- ✅ **Availability-as opgeruimd (FE-UI):** aparte Availability-settings-tab verwijderd (= Status).
- ✅ **Mock-fix:** shim verzint geen deployability meer voor Lead/Kandidaat (leeg ipv "Beschikbaar").

- ✅ **Verplichte velden — enforcement in AddCandidateModal:** ster + foutmarkering + opslag-blokkade,
  fase-afhankelijk uit `candidate_required_fields`.
- ✅ **B-10 (gating) effectief weg:** `isApplicantStatus`/`hasApplicantStatus` hebben geen consumers
  meer en `ApplicationStageChips` wordt nergens gerenderd (funnel staat in de Match-tab) — geen
  status-gebaseerde funnel-gating meer. (Flag uit context/settings strippen = optionele opruiming.)

**Nog open (FE):**
- ☐ Resterende FE-availability-refs opruimen (`/availability-options`-call + `availabilityMeta` +
  `availability`-kolom in mapCandidate) — **ná backend Golf ①** (schone breuk, geen kapot tussenmoment).
- ☐ Verplichte velden ook in de **drawer**-edit afdwingen (AddModal is klaar) — leest `candidate_required_fields`.
- ☐ KPI-row + filters op de nieuwe assen; **match-kiezer** in de Geplaatst-popup (hangt op C-19).
- Hangt voor echte data op **C-10** (phases-lookup + statuses-reseed/flags + migratie + availability weg).

### C-1 · Lookups — "in gebruik"-vlag + 409 ◐
Verifiëren met ingelogde sessie: vacancy status/fase toevoegen + reorder werkt.

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
**Uitbreiding 2026-07-01 (FE-wensen):**
- Lever per kanaal een **`*_consent_at`**-timestamp → FE toont datum+tijd **naast het vinkje** (drawer).
- **Bulk-consent-endpoint** `POST /candidates/bulk/consent` (opt-ins voor selectie) → FE-node in de bulk-`ActionMenu`.
- **`document.created_at`** meesturen op documenten (Documenten-tab toont toegevoegd-datum; FE rendert 'm al).
- **`note.created_at`** op notities (FE toont datum+tijd i.p.v. "zojuist"; valt terug op relatief). Zie C-16.
> **FE-vervolg (na deze endpoints):** bulk-consent-node bouwen + consent-timestamp inline tonen. De rest van
> deze batch (notities datum/tijd, documenten rename-alleen-naam + datum-render, convert→profiel-bewerken,
> voorkeuren-chips-in-tabel) is **FE-klaar** (2026-07-01).

### C-13 · Messaging-shapes + attention-tiles
Shapes bevestigen + `no_followup_planned` + `active_conversation` + outreach-shape leveren.

### C-15 · Bulk-mutaties — array-uitbreiding
`POST /candidates/bulk/candidate-type` moet `candidate_types: []` (array, REPLACE) accepteren.

### C-16 · Audit log — meer dekking
Subject-velden mee in `/activity-log` + `GET /candidates/{id}/activity`.

### C-18 · Taken — tabellen + endpoints + seeder
Volledige taken-feature (kanban, lookups, comments, seeder). **Core = klaar** (index/stats/
detail/update/links/comments/activity/bulk-archive live; e2e getest 2026-07-01).

**Resterend (voedt de blueprint-gelijktrekking van B-20):**
- ✅ **`GET /contacts` + `GET /departments` — KLAAR (backend + FE, 2026-07-01).** Beide platte
  tenant-lijsten live (`{id, name, customer_id, customer_name}`, `?q=`+`?per_page=`, `customers.view`).
  FE: koppel-picker + modal-contactpicker consumeren ze; picker-search stuurt nu `q` (was `search`).
  E2e geverifieerd (shape + `?q=` filtert). Alle 9 koppel-types werken nu.
- ✅ **Tags op taken — KLAAR (backend + FE, 2026-07-01).** `Task` had `tags` al (fillable + array-cast,
  Store/Update valideren `tags[]`, resource geeft ze terug). FE: header-tag-editor in de drawer.
- ✅ **Tabel-kleurtoggles — KLAAR (FE, 2026-07-01).** Via de generieke `Setting`-store (`POST /settings`),
  schema `taskDisplay` + Settings → Taken → Tabelweergave; `task_table_color_status|priority|type` (default aan).
- ℹ️ **Omschrijving = rich text (HTML).** FE slaat de omschrijving nu als HTML op (drawer + modal, zoals
  candidate-summary); de `description`-tekstkolom houdt dit gewoon. Geen backend-wijziging nodig.

### C-18a · Subtaken op een taak  *(NIEUW — beslissing Danny 2026-07-01: JA)*
`tasks.parent_id` (nullable, self-FK) **of** een lichte `task_subtasks`-tabel in de bestaande
`create_tasks`-migratie vouwen. Detail-endpoint geeft `subtasks: [{id,title,status(+is_done),due_date?}]`;
store/update accepteert child-taken (of hergebruik `POST /tasks` met `parent_id`). FE toont een
afvinkbare checklist in de drawer (P2, na backend).

### C-18b · Bellijsten / Outreach-campagnes — eigen entiteit  *(NIEUW — beslissing Danny 2026-07-01)*
Aparte entiteit (géén taak overladen): een **bellijst/campagne** die **meerdere kandidaten** bundelt met
**per-kandidaat status** (te benaderen · benaderd · overgeslagen · beantwoord) en een **kanaal**
(bellen · e-mail · WhatsApp). Gegenereerd **uit een talentpool** (`/pools`) of een selectie.
Voorstel-tabellen: `outreach_campaigns` (`id, tenant_id, name, channel, source_pool_id?, owner_id, status,
created_by`) + `outreach_targets` (`campaign_id, candidate_id, status, contacted_at?, note?`). Endpoints:
CRUD `/outreach-campaigns` (+ genereren uit pool), `PATCH /outreach-targets/{id}` (per-kandidaat afvinken),
stats. FE = nieuwe feature-page (mirror candidate-blueprint) + koppeling naar WhatsApp/e-mail. Groot; apart plannen.

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

### ☐ C-26.1 · Vacature-detail gelijktrekken met de kandidaat  *(NIEUW — FE draait al op deze shape)*
De FE-`DetailsTab` is herbouwd naar het kandidaat-model; de mapper is leidend. Voeg op **`vacancies`**
(vouw in `create_vacancies`) toe + geef terug in `GET /vacancies/{id}` en accepteer in `PATCH`:
- **`contract_types` (json/array)** — dezelfde lookup als de kandidaat (`candidate_types`, multi). *(Soort dienstverband
  vervalt; de FE-settings-subtab `/vacancy-employment-types` mag weg.)*
- **Gestructureerd adres:** `street, house_number, house_number_suffix, postcode, city, province` (+ optioneel
  afgeleide `location`-string). *(Zoals kandidaat.)*
- **Ervaring van–tot:** `experience_min_years`, `experience_max_years` (int, null).
- **`category`** = **functie** uit de bestaande `/functions`-lookup (settings-beheerd); **branche** = `industry`
  uit `/industries` (voorkeursbranche). **`description`** = HTML/rich text (zoals kandidaat-`summary`; sla veilig op).
- Bevestig of lookup-velden als **slug** (`seniority`,`education`) of als **`*_id`** verwacht worden — de FE stuurt
  nu de slug/waarde; graag matchen of laten weten.

### ☐ C-26.2 · Vacature — Extra velden · Documenten · Notities · Matchprofiel  *(NIEUW — blokkeert FE-tabs)*
- **Eigen velden (Extra-tab):** lever **getypeerde definities** zoals `/candidate-custom-fields`
  (`key,label,type,options?`) via `/vacancy-custom-fields`, + per-vacature `custom_fields`-map in detail/PATCH.
  FE toont dan een **Extra-tab alleen als er definities zijn** (mirror kandidaat).
- **Documenten:** `GET/POST /vacancies/{id}/documents` (multipart) + `DELETE …/{docId}` + `document_types`
  (zoals kandidaat C-3). Detail geeft `documents[]` met download-URL.
- **Notities:** `GET/POST /vacancies/{id}/notes` (+ `/note-types`), detail geeft `notes[]`; zoals kandidaat.
- **Sollicitatie-instellingen — tenant-default:** een **settings-endpoint** voor de standaard
  `application_settings` (`cv/cover_letter/photo/remarks/interview_consent → required|optional|hidden`); nieuwe
  vacature erft die default, per-vacature override op de vacature (bestaat al in PATCH).
- **Matchprofiel (i.p.v. losse gewichten):** entiteit **`match_profiles`** (tenant-scoped: `id,name,weights{6 dims}`,
  `is_default`). Endpoints CRUD + koppel per vacature (`vacancy.match_profile_id`) met **override** (`match_weights`
  blijft de per-vacature afwijking). FE-Matching-tab kiest profiel of stelt default in en past nog per vacature aan.

### C-27 · Klanten — endpoints + sub-entiteiten + seeder
Volledige CRUD + locaties/afdelingen/contactpersonen + 15–20 klanten geseed.
- **Nog te leveren (frontend consumeert ze al, nette lege staat tot ze live zijn):**
  `GET /customers/{id}/activity` (audit-trail voor de changelog-popover: `{id, description, author, created_at}`)
  en `/customers/{id}/documents` (multipart POST + `PATCH {name}` + DELETE; rij `{id, name, type, size, url, created_at}`;
  document-types via de bestaande `/document-types`-lookup). Spiegelt de kandidaat-endpoints.
- **Optioneel op de `/customers`-rij:** `koios_advice {action,label,reason}` (voedt de Koios-adviescolom in
  de klantentabel; kolom toont `—` tot het veld er is). Kleur-per-kolom = tenant-settings
  `customer_table_color_{status,owner,koios}` (frontend-defaults, geen backend nodig).

### C-29 · Aangepaste velden + verplichte-velden-per-fase + duplicate/merge (kandidaat eerst) [BE]
Uitgebreid 2026-06-29 (migraties gevouwen in `create_*`; modellen; seeders; API's):
- **`candidate_custom_fields`-tabel** (tenant): `key, label, label_i18n(json, optioneel per taal —
  leeg = fallback op `label`), type∈{text,number,date,select,boolean,textarea}, options(json),
  required_for(json:fase-keys), `show_in_table`(bool, default false), order, active, has_data`.
  CRUD `/candidate-custom-fields` (lookup-contract + 409/`in_use` + reorder). **Type niet wijzigbaar
  bij `has_data`.**
- **`custom_fields` JSON-kolom** op candidate; GET/PATCH leveren/accepteren `{key:value}`; **server-
  validatie per type**.
- **Verplichte velden:** ingebouwd via `/settings`-key `candidate_required_fields = {lead:[],candidate:[]}`
  (geseed); custom via `required_for`. **422** bij leeg-verplicht voor de huidige fase + bij fase-promotie.
- **Duplicate:** `/settings`-key `candidate_dedupe_keys` (default `["email","mobile"]`);
  `GET /candidates/check-duplicate` → `{exists, match?}`; create met match → **409** `{message, existing}`.
- **Merge:** `POST /candidates/{survivor}/merge {source_id, field_choices}` — transactioneel sub-entiteiten
  omhangen, `field_choices` toepassen, bron soft-delete/anonimiseer, audit-log. Hard-delete blijft BE-only.

### C-30 · `GET /dashboard` summary-endpoint
KPIs + recents + filterbronnen in één call.

### C-31 · Dashboard charts-data
Tijdreeksen + verdelingen + funnel voor grafieken.

### C-32a · Afwijzing via workflow — event-trigger + queue
`application.rejected` event + workflow-trigger + multi-kanaal-bericht + tokens.

### C-43 · WhatsApp-privé wachtrij — outbox + classificatie + prioriteit + rate-limit (contract)
Dedicated **tenant-scoped outbox** per privé-bericht (`status`/`attempts`/`scheduled_at`/`number_id`/
`candidate_id`/`message_type_id`/`priority`) — niet de raw `jobs`-tabel. Drain op **(priority DESC,
scheduled_at ASC)** binnen een **rate-limit per nummer** (instelbaar). Endpoints:
`GET /whatsapp-web/queue?status=&type=&number_id=` + `send-now`/`pause`/`cancel`/`retry` +
`GET /whatsapp-web/queue/stats`; lookup `/whatsapp-message-types` (CRUD+reorder, in-use-protected,
priority+kleur). **BE geleverd 2026-07-01** (`whatsapp_outbox` + `whatsapp_message_types`, drain/minuut per nummer,
seed application/match/reminder/general/birthday/marketing; **stats per-nummer**; mutaties `messaging.manage`,
lookup-writes `settings.update`; body encrypted/PII-arm). **FE afgestemd ✅.** Zie ook **C-32a**. FE = **B-28**.
Open (BE): enqueue-triggers + demo-queue; kanaalfouten → failed/retry (v2); `dev:reset`.

### C-32b · Pakket-/module-model
3 pakketten + add-ons + `GET /admin/tenants/{id}/usage`.

### C-33 · `ui_preferences` op users
JSON-kolom + `GET /auth/me` levert hem + `PATCH /users/{id}` accepteert hem.

### C-34 · Dashboard + Rapporten endpoints
`GET /dashboard` + `GET /reports/flow|recruiters|intakes|vacancies|matches`.

### C-35 · `dashboard_type` op rollen
Kolom + seed 7 standaard-rollen + `GET /auth/me` geeft `roles[].dashboard_type`.

### C-36 · Kandidaat-instellingen + voorkeuren — endpoints, opslag, seed (FE klaar · BE: lookups gedicht, opslag open)
De **frontend is volledig** voor candidaat-instellingen + Voorkeuren-tab; wat nog mist is **uitsluitend
backend** (resterende opslag). Dagen = vaste Intl-lijst (géén API). Lookups zonder data → drawer valt
fail-soft terug op de FE-seed.

**(a) ✅ `/driver-licenses`** — live op demo+yesway (tabel + 15 NL-categorieën, zit in `CandidateLookupSeeder`
→ `dev:reset` vult het). Settings-editor én drawer lezen nu echte data. (BE-Claude, 2026-06-27)
**(a2) ✅ `/candidate-rejection-reasons`** — 7 standaardredenen live geseed (idempotent). ⚠️ Reproduceer-eindje:
zit nog in **géén** seeder → BE voegt ze toe aan `CandidateLookupSeeder` zodat `dev:reset` ze ook vult.

**(b) Lookup-CRUD-contract dat élke candidate-settings-editor verwacht** (`StatusListEditor` /
`CandidateLookupsSettings`): `GET` · `POST` · `PUT /{id}` · `DELETE /{id}` (409 + `in_use`-vlag als
referenced) · `PUT /{id}/reorder` (of `/reorder` met `{ ids: [] }`). Alle moeten **geseed** zijn,
anders toont de editor niets en valt de drawer terug op de FE-seed. Endpoints die de candidaat-
instellingen raken: `/genders` · `/functions` (+`allow_free_entry`) · `/industries` (C-7) ·
`/driver-licenses` (✅ live) · `/languages` + `/language-levels` · `/availability-options` ·
`/last-contact-types` + `/note-types` (C-21) · `/pools` · `/settings/candidate-lookups/{statuses,
candidate-types,funnel-types}` (C-1/C-10).

**(c) Preferences-opslag** — `PATCH /candidates/{id}` met de **`preferences` JSON** (FE stuurt de hele
blob). Velden: `preferred_days[]` · `function_pref` · `sector_pref[]` · `license_categories[]`
(**vervangt** `has_license` bool) · `wage_tax` (bool) + `wage_tax_from` (date) · `available_from` ·
`hours_per_week` · `max_travel_km` · `max_travel_min` · `own_transport` · `remarks` (HTML-rich-text).
`preferred_days` / `sector_pref` zijn nu **arrays** (waren string).

**(d) `/settings`-keys** (merge-by-key, tenant weergave-voorkeuren kandidatentabel):
`candidate_table_color_funnel` / `_type` / `_pool` / `_koios` (bool, default uit) ·
`candidate_table_color_status` (bool, **default aan**) · `candidate_table_color_owner` (bool, **default aan**) ·
`candidate_avatar_colored_by_gender` (bool, default uit).
⚠️ **Booleans als `true`/`false` opslaan** (string of echte bool) — **niet** `1`/`0`. De FE leest booleans
strikt als `true`/'true' (consistent met de toggle); een `1` wordt als *uit* gelezen → toggle-uit maar
tóch gekleurd-bug. Seeder/migratie dus met `true`/`false`.

**(e) Migratie:** bestaande `has_license`-data → `license_categories[]`.

### C-37 · Kandidaat — laatste hardcoded lijsten ontkoppeld (FE klaar · BE: endpoints + seed)
De frontend haalt nu **alles** rond kandidaten uit de API; deze drie endpoints/keys moeten
backend-zijdig nog bestaan + geseed worden. Tot die tijd valt de FE fail-soft terug op een seed.

**(a) `/note-types`** (lookup-CRUD-contract C-36b, **geen kleur** nu — `withColor={false}`). Seed 6
standaarden in `CandidateLookupSeeder`: `Algemeen · Intake · Feedback · Afspraak · Follow-up ·
Waarschuwing`. Opgeslagen op de notitie als `type` (value/slug). FE: `useNoteTypes()` +
`NoteTypesSettings` (bestond al). *(Optioneel later: kleurkolom → dan note-chips gekleurd; FE
ondersteunt `color` al.)*

**(b) `/document-types`** *(NIEUW)* — lookup-CRUD-contract C-36b **mét kleur** (`color`-kolom, hex of
`var(--color-*)`). Seed 7 standaarden + kleuren: `CV`(secondary) · `ID-bewijs`(#8B5CF6) ·
`Diploma`(warning) · `Contract`(#059669) · `VOG`(danger) · `Certificaat`(#EC4899) · `Overig`(#6B7280).
Opgeslagen op het document als `type` (value/slug). FE: `useDocumentTypes()` (label+kleur) +
nieuwe `DocumentTypesSettings`-subtab (Personalisatie → Kandidaten).

**(c) `candidate_cv_template` in `/settings`** — CV-template-config verhuisd van browser-`localStorage`
naar de tenant-`/settings`-blob (was per-device, nu per-tenant; AVG/§7). JSON-waarde:
`{ primaryColor, secondaryColor, logoUrl, companyName, sections[] }`. Werkt via de generieke
merge-by-key `/settings` (C-36d) — alleen bevestigen dat de key meekomt in GET/POST.

### C-38 · Overzicht — wat backend nog mist voor de **complete** kandidaat (table · drilldown · settings)
Geen nieuw werk, een **kaart** zodat BE-Claude de hele kandidaat in één blik ziet (verwijst naar
bestaande C-items):
- **Tabel/KPI-row:** `GET /candidates/stats` (server-brede tellingen per status/funnel/recruiter/
  niet-gecontacteerd/intake-gepland/taken — niet paginabreed) · `last_contact_at`/`_type`-kolommen +
  `facebook_lead_id` (C-21) · soft-delete-filters (inactief/blacklist/archived standaard uit, C-21).
- **Drilldown (drawer):** sub-entiteit body-contracten (C-2) · álle kandidaat-velden incl.
  `place_of_birth` (C-23) · Matches read-only (C-19) · Sollicitaties-funnel (C-23) · Changelog
  `/candidates/{id}/activity` (C-16) · Afspraken/Intakes + `requires_appointment`-vlag (C-22) ·
  kanaal-consent `*_opt_in` (C-11) · documenten-upload + `type` via `/document-types` (C-37b) ·
  note-types (C-37a) · branches (C-4).
- **Settings:** álle lookup-CRUD-contracten geseed + 409/`in_use` + reorder (C-36b) · `/note-types`
  (C-37a) · `/document-types` (C-37b) · `candidate_cv_template` (C-37c) · tabel-kleur-`/settings`-keys
  met booleans als `true`/`false` (C-36d).

### C-40 · Gebruikersbeheer — drie endpoints (FE klaar · BE open)

Frontend (`#administration/users`) is volledig gebouwd; backend mist drie dingen:

**1. `PATCH /api/users/{id}` — profiel bewerken**
Accepteert (elk veld optioneel):
```json
{ "firstname": "Jan", "lastname": "Jansen", "email": "jan@bedrijf.nl", "phone": "+31612345678", "password": "nieuw" }
```
- Alleen admin/eigen account mag dit aanroepen.
- `password` alleen hashen en opslaan als het meegestuurd wordt.
- Response: `{ "data": { <user-object> } }` met `id, firstname, lastname, name, email, phone, avatar_color, roles[]`.
- **Let op:** stuur altijd `firstname` + `lastname` **apart** terug (niet alleen `name`), anders kan de FE edit-modal de velden niet pre-fillen.

**2. `PUT /api/users/{id}/roles` — rol wijzigen**
```json
{ "roles": [3] }
```
- `roles` = array met één role-ID (integer) — het ID dat `GET /api/roles` teruggeeft.
- Vervangt alle rollen van de gebruiker (behalve super_admin — dat is beschermd).
- Response: bijgewerkt user-object (zelfde shape als hierboven).
- **Bug nu:** 500-fout → check of de route bestaat en of `roles` als array van IDs verwacht wordt.

**3. `GET /api/roles` — beschikbare rollen**
```json
[{ "id": 2, "name": "tenant_admin" }, { "id": 3, "name": "planner" }, { "id": 4, "name": "user" }]
```
- Geeft alle tenant-rollen terug (super_admin mag erin maar FE filtert die eruit).
- **Nu:** 401 → zorg dat dit endpoint bereikbaar is voor ingelogde tenant_admin.

**Auth-gate voor `/api/users` en `/api/roles`:**
- `GET /api/users` + `GET /api/roles` → vereist Sanctum-sessie + rol `tenant_admin` (of hoger).
- **Nu:** beide geven 401 → sessie/CSRF-gate klopt niet of middleware mist.

**Avatar-kleur:**
- `avatar_color` is nullable string op de `users`-tabel. `null` = reset naar automatisch.
- Wordt gestuurd via diezelfde `PATCH /api/users/{id}`.

---

### C-27-workflow · Workflow-modules — graaf-opslag + run-historie + token-substitutie
1. **Graaf-opslag.** Steps opslaan met `position` + `connections[]` (target + filters). **Stabiele step-ids**
   (Router-branches collapsen anders naar een rechte lijn bij reload). FE overbrugt nu via localStorage
   (`wf_graph_<id>`) tot dit persistent is.
2. **Run-historie (NIEUW — FE gebouwd 2026-07-01, wacht op endpoint).** `GET /workflows/{id}/runs` → lijst runs;
   elke run met `step_results[]`, per stap `{ label, type, status, message, input, output, duration_ms?,
   operations? }`. De editor-tab **GESCHIEDENIS** + de gedeelde `RunDetailDrawer` tonen dit (per-stap
   **INPUT/OUTPUT** uitklapbaar). FE valt terug op `/workflow-runs` (ongefilterd) zolang dit ontbreekt.
3. **Token-substitutie (NIEUW — FE gebouwd 2026-07-01).** De variabele-picker schrijft `{{<stepId>.<pad>}}` (en
   `{{<stepId>}}` voor de hele output) in string-configs. De engine moet die **tijdens een run vervangen** door de
   output van de betreffende stap — de stabiele step-id uit punt 1 is de koppeling. Pad = dot-notatie
   (`employee.city`); arrays resolven via het eerste element.

---

### C-41 · Opportunities (Kansen) — blueprint-pariteit: stage-id, activity, bulk, tags, notities, locatie
De Kansen-tabel + drawer zijn opgetrokken naar de candidate-blueprint (owner-avatar+naam, sticky/sort, bewerkbare
Details, inline titel-edit, Gewonnen/Verloren-quickactions, Changelog-tab, rechter-filterpaneel). Deze delen hangen
op de backend:

1. **Stage-id + vlaggen op de rij (klein, hoge prio).** `OpportunityResource.stage` levert nu enkel
   `{value,label,color}`. Voeg **`id`** + **`is_won`/`is_lost`** toe (of top-level `opportunity_stage_id`), zodat de
   FE-picker op id kan keyen en Gewonnen/Verloren robuust is (nu matcht de FE op slug). Expose ook **`location`**
   (`{id,name}`) op de resource — kolom `location_id` bestaat al.
2. **Activity read-endpoint.** `GET /opportunities/{id}/activity` (zoals C-16 voor kandidaten). De controller logt
   al `activity('opportunities')`; alleen de read ontbreekt. Shape `[{ id, causer_name, description, log_name,
   created_at }]`. De FE-Changelog-tab is 404-tolerant en licht op zodra dit er is.
3. **Bulk-endpoints** (contract = C-15/C-26, respond met `updated`/`skipped`/`archived`):
   `POST /opportunities/bulk/{stage,owner,client,archive}` (+ `tags/remove` als tags landen). Body
   `{ opportunity_ids:[…], stage|owner_id|customer_id }`. Autorisatie server-side (delete-perm voor archive).
   Zodra dit er is bouwt FE de `OpportunitiesBulkBar` + rij-selectie (mirror `VacanciesBulkBar`).
4. **Tags.** `tags` (json/relatie) op `opportunities` + op de resource → FE zet de tag-editor in de drawer-header
   aan (EntityHeader ondersteunt 'm al).
5. **Notities.** `GET/POST /opportunities/{id}/notes` (+ `note_types`-lookup), sub-entiteit-contract zoals
   kandidaat/klant → FE hangt de gedeelde `NotesTab` in de drawer.
6. **Seeder-verrijking.** Zet op de 12 geseede kansen wat activity/notes/tags + een `location_id` zodat de nieuwe
   tab/kolom meteen data tonen.

**FE-follow-up (geen backend):** `OpportunitiesInsightsRow` overzetten op `GET /opportunities/stats` (bestaat al)
i.p.v. pagina-lokaal afgeleide KPI's — nodig zodra paginatie/scale telt.

Hangt samen met **C-28** (opportunities-basis), **C-15/C-26** (bulk-contract), **C-16** (activity-read).

### C-42 · Opportunities (Kansen) — zorg-detacherings-model (uren, looptijd, dienst/overeenkomst-type, org-hiërarchie, taken)
**Doel:** de Kans van "€-deal" uitbreiden naar een echte zorg-detacherings-opportunity. Datamodelkeuzes met Danny
(2026-07-01): **waarde (€) én uren los invoeren**; **looptijd = start- + einddatum** (want "kan verschillen", +
optioneel snelkeuze-lookup); **dienst/sector** en **overeenkomsttype** als tenant-lookups; **org-koppeling**
klant→locatie→afdeling→contactpersoon; **taken** zichtbaar op de Kans. FE is FE-first met seed-fallback gebouwd —
persistentie/roundtrip van de nieuwe velden wacht op dit item.

**1. Velden op `opportunities` (vouw in de bestaande `create_opportunities`-migratie — géén `add_*`):**
`hours` (decimal, null), `hours_period` (enum/string: `week|month|total`, default `week`), `start_date` (date, null),
`end_date` (date, null), `service_type_id` (FK `opportunity_service_types`, null), `agreement_type_id`
(FK `opportunity_agreement_types`, null), `department_id` (FK `departments`, null), `contact_id` (FK `contacts`, null).
`location_id` bestaat al. (`value`/`currency`/`expected_close_at` blijven.)

**2. Lookups (tenant-scoped, geseed, in-use-protected → 409, reorderable — mirror `VacancyEmploymentType`):**
- **`/opportunity-service-types`** — seed **Detachering · Zorg · Zorg-detachering**.
- **`/opportunity-agreement-types`** — seed **Samenwerkingsovereenkomst · Mantelovereenkomst**.
- (optioneel) **`/opportunity-contract-terms`** — seed **1 jaar · 3 jaar · Onbepaald · Anders** (snelkeuze die
  start/eind vult; de datums blijven de bron van waarheid).

**3. Org-hiërarchie (afhankelijke koppeling).** Kans → `customer_id`(✓) → `location_id`(✓) → **`department_id`** →
**`contact_id`**. Lever per klant de sub-lijsten zodat de FE afhankelijke pickers kan tonen: `GET /customers/{id}/
locations`, `…/departments` (per locatie), `…/contacts` (hangt op **C-27**). Resource geeft geneste
`location`/`department`/`contact` (`{id,name}`) terug.

**4. Taken op de Kans.** `opportunity_id` (of polymorf `taskable`) op `tasks` + **`GET /opportunities/{id}/tasks`**
(hangt op **C-18**). FE hangt er een **Taken-tab** aan.

**5. Resource + seeder.** `OpportunityResource` uitbreiden met alle velden + geneste dienst/overeenkomst/afdeling/
contact + `hours`/`hours_period`/`start_date`/`end_date`. Seeder: zet op de 12 geseede kansen realistische uren,
looptijd, dienst/overeenkomst-type, een afdeling+contact en 1–3 gekoppelde taken zodat de nieuwe kaarten/tab meteen
data tonen.

**FE-shape die gelezen wordt** (mapOpportunity, tolereert afwezig): `hours`, `hours_period`, `start_date`,
`end_date`, `service_type{value,label,color}`/`service_type_id`, `agreement_type{…}`/`agreement_type_id`,
`location{id,name}`, `department{id,name}`, `contact{id,name}`.

Hangt samen met **C-28** (basis), **C-27** (klant-subentiteiten), **C-18** (taken), **C-41** (bulk/tags/activity).

---

### 🔴 C-44 · Planning-module — Orders, Shifts, Inplanning (assignments), Uren (FE wacht · volledig contract in chat 2026-06-21)
FE-doel (Danny): diensten (**orders**) aanmaken met **shifts**, kandidaten **inplannen**, **uren** invullen — 0% mock.
Ontbreekt backend-breed. Nieuwe entiteiten (tenant-scoped, UUID-PK, `planning.*`, 409/422, audit, migratie-conventie):
- `planning_orders` (customer/location/department/function, status-lookup, hasMany shifts; delete-409 bij actief werk)
- `planning_shifts` (order?/customer/function/shift_type/date/start/end/break/spots/status; **derived** `open_spots`;
  filters: `open_only`, `candidate_id` → fit-annotatie `{distance_km, function_match, available, blacklisted}`)
- `planning_assignments` (shift↔candidate, status-lookup; unieke actieve → 409; guards: spots, availability, blacklist)
- `planning_hours` (per assignment; actual_start/end/break; **derived** total_hours; status draft→submitted→approved)
Endpoints: `/planning/orders` · `/planning/shifts` · `POST /planning/shifts/{id}/assignments` ·
`PATCH|DELETE /planning/assignments/{id}` · `POST /planning/assignments/{id}/hours` · `/planning/hours/{id}(/approve)`.
Lookups (Settings → Planning, **niets hardcoded**): shift-types · order/shift/assignment-statuses (kleur + reorder + in-use-409).
**Bevestig ook de al geleverde rij-shapes:** `/planning/schedules`, `/planning/shifts`, planning-preferences
(`linkable_type` = alias customer|location|department? GET zonder `kind` = beide? POST echoot de rij incl. id+naam?),
availability (`date`, part-enum day|morning|afternoon|evening, `status`, `reason`).
Hangt samen met **MOCK-1** (kandidaat-Planning-tab) + de Planning-Settings-subtabs.
**FE-status:** Voorkeur/blacklist ✅ + Beschikbaarheid ✅ gekoppeld; read-tabs (schedules/shifts) wachten op shape-bevestiging;
orders/inplannen/uren + het losse Planbord (`PlanningPage`, nu mock) wachten op déze backend.

---

## E. TypeScript-migratie (FE — ✅ klaar in eigen domein)

> Hele repo → TS, **groen per golf** (`typecheck`+`lint`+`build`+`test`), incrementeel op main.
> Nieuw bestand = altijd `.ts`/`.tsx`. **Candidate-/settings-mappen + `Sidebar.jsx` = andere Claude (afblijven).**

**✅ Klaar (gepusht):** `lib/` · `context/` · gedeelde blueprint (drawer/forms/insights/charts/settings-views) ·
candidate-feature · alle 6 entity-features (customers/applications/vacancies/tasks/opportunities) +
modules-registry · auth · reports (18) · matches · whatsapp · dashboard · planning · ai (8) · koios (7) ·
layout-shell (DashboardLayout/TenantSwitcher/appPages) · workflow-serialization · shiftmanager 26/26 ·
**E-2 workflow-editor-core (WorkflowCanvasEditor + canvas/fields/ScheduleModal/contexts)** ·
**shiftmanager charts/orders-cluster (10)** · **app-shell (App/main/i18n)** · **users (UsersPage/NewUserModal)** ·
**C-35-prep (dashboard_type op rol-shape + `dashboardType()`-helper, backward-compatible)**.
Types in `src/types/*` (api+ManagedUser · candidate · application · vacancy · customer · opportunity · task ·
reports · match · whatsapp · dashboard · planning · workflow · ai · koios · shiftmanager).

**🗑️ Dode code verwijderd:** `components/workflows/{ScheduleSettings,scheduleEditors}.jsx` (vervangen door
`layout/workflow/ScheduleModal.tsx`) · `theme/BrandTheme.jsx` (huisstijl loopt via CSS-vars, 0 importers).

**☐ Resterend (buiten mijn domein):** `settings/` (~70 files) + `Sidebar.jsx` = andere Claude · `test/setup.js`
blijft test-infra (`.js`). **In het frontend-domein is de migratie hiermee rond.**

**Patroon-notities:** dynamische-key-sort → `(av as number)`-cast · losse API-payloads → permissieve
interfaces met index-sig (**geen `any` in datamodellen**) · `useAuth() ?? {}` · JS-boundary-componenten
`as unknown as ComponentType<…>` · filter(Boolean) → `.filter((x): x is string => Boolean(x))` ·
recharts-props uit publieke types geomit (Legend `payload`) → `@ts-expect-error` met reden ·
`ShiftFilterGroup` index-sig zodat 'ie naar RightPanel's `Record<string,unknown>` mag.

**Na de migratie (besloten volgorde 2026-06-27):** (1) audit-convergentie-loop tot 0 findings → (2) refactor
de >400-splits (§F-1) → (3) `/architect` tegen ARCHITECTURE.md → (4) CLAUDE.md harden naar master-standaard.

---

## F. Kwaliteit & architectuur (FE — gefold uit MASTER-PLAN P2–P4 + architect-findings)

### Modulariteit
- ☐ **F-1** Splits > ~400 r: `ReportFilterSidebar` (490) · `MessagesTable` (423) · `WorkflowCanvasEditor` (878) → elk single-purpose < ~400.
- ☐ **F-2** Blueprint-conformiteit per entiteit (vacancies/customers/applications/matches/opportunities/tasks = zelfde shape als candidate; gedeelde DataTable/InsightsRow/ActionMenu/bulkMutate; geen 2e MODULE_META).
- ☐ **F-3** DUP: `shiftmanager/CustomersInsightsRow` = near-duplicate van gedeelde `InsightsRow` → samenvouwen. AW-9: editor-datumveld → datepicker (DD-MM-YYYY).

### i18n compleet (geen Dutch islands)
- ☐ **F-4** Workflow-editor (~60 strings, 0×`t()`) + module-registry labels/categorieën × 5 locales.
- ☐ **F-5** Settings `registry.jsx` (66 hardcoded nav-labels, 0×`t()`) → `t()` × 5 locales.
- ☐ **F-6** `AppsContext` NL-descriptions · `ViewConfigEditor` EN-strings → via `t()` × 5 locales.
- ☐ **F-7** Project-brede i18n-grep op JSX-literals → 0 findings. VOC-restant: CompanySettings-lijsten + SM-statussen → lookups.

### Kwaliteit & schaalbaarheid
- ☐ **F-8** CS-6: inline `api.*` → feature-`api/`-laag (~72 files).
- ☐ **F-9** CS-9: tests op kritieke paden (bulk-mutate optimistic/reconcile, mappers, 4 UI-states, auth-gated UI).
- ☐ **F-10** a11y WCAG 2.2 AA: focus-trap+restore drawers/modals · aria-labels op icon-knoppen · kleur≠enig-signaal · contrast ≥4.5:1.
- ☐ **F-11** Virtualiseer grote tabellen (kandidaten/shifts, 10k+ rijen).
- ☐ **F-12** DX: dev-only API-foutmelding (METHOD url→status) · silent `.catch(()=>{})` → min. dev-log · duidelijke user-facing error-states i.p.v. lege schermen.

### Auth-flip (gated op backend)
- ☐ **F-13** N-2: Sanctum httpOnly-cookieflow aanzetten (`withCredentials` + CSRF-priming, Bearer-localStorage uitfaseren) — **pas flippen ná de gecoördineerde backend-deploy** (BE-8). FE-scaffold (`VITE_COOKIE_AUTH`) bestaat.

---

## G. Audit-findings (file-by-file, 2026-06-29)

> Bewijslast in `docs/AUDIT.md`. Geprioriteerd; **FE** = ik fix in de convergentie-loop · **BE/2e-Claude** =
> handoff. Volgorde van uitvoeren: **P1-FE-veilig → R-splits (F-1) → her-audit → herhalen → CLAUDE.md harden**.

| ID | Sev | Eff | Eigenaar | Item |
|---|---|---|---|---|
| **I18N-1** | ✅ | — | FE | **OPGELOST.** Volledige `workflows:modules.*` (53 types) + `categories.*` (18) in nl/en/de/fr/es; `ModulePicker`/`ConfigPanel` renderen via `t('modules.<type>')` + `t('categories.<slug>')` (`moduleI18n`-slugmap, matching blijft op registry-waarde). |
| **I18N-2** | ✅ | — | FE | **OPGELOST.** Alle 5 workflow-componenten §5-compleet: editor-chrome · `fields` · `fieldControls` · `ModulePicker` · `ConfigPanel` (blokken `editor`/`fields`/`picker`/`config` × 5 locales). **Workflow-editor is geen Dutch-island meer.** |
| **MOCK-1** | P1 | M | BE+2e | kandidaat-Planning-tab op `data/mocks.ts` → planning-endpoints + hooks |
| **F-13** | P1 | M | FE (gated) | `auth_token`/`auth_user` uit `localStorage` → httpOnly-cookieflip (ná backend-deploy) |
| **D-1** | P1 | M | BE+FE | changelog (`/activity`) op customers/vacancies/applications/tasks/opportunities |
| **D-6** | ☐ | M | BE+FE | **Matches drill-down** (read-only, §3B). Backend: `GET /matches/{id}` mét `candidate_id`+`vacancy_id` (klikbare linkage) + placement-velden · `GET /matches/{id}/activity`. FE: `MatchDrawer` (gedeelde EntityDrawer/EntityHeader/DrawerTabs) + `onRowClick` op MatchesTable → **na** backend (anders weggooi-drawer). Eigenaar FE = matches (Instance-X), **niet** Claude C. |
| **D-2** | ◐ | M | FE | soft-delete (archive) op tasks/opportunities/applications. **Applications BE geleverd (2026-07-01):** `DELETE /applications/{id}` = soft-detach (rij blijft, incl. `match_score`/criteria + funnel-historie; standaard verborgen) · `POST /applications/{id}/restore` (perm `applications.update`; zet kandidaat terug op applicant-fase) · `GET /applications?include_archived=1`. **FE applications ✅ (2026-07-01):** "Gearchiveerd"-toggle laadt `?include_archived=1`; drawer-footer = Ontkoppelen (danger, gated `applications.update`) / Herstellen; optimistisch + toast + revert; i18n ×5; `mapApplication.archived`. **Backend tasks+opps ✅ (`d4a3cb8`, branch `feat/c29-custom-fields`):** `DELETE`+`/restore` + `?include_archived=1` (tasks-perm `tasks.delete`→align naar `.update`; opps `.update`). **FE tasks+opps detach = gequeued** (na F-8 batch 1; wacht tot branch op main). |
| **F-11** | P1 | L | FE | lijst-virtualisatie (kandidaten/shifts, 10k+ rijen) — schaal-blocker |
| **I18N-3** | ✅/2e | — | 2e | FE-domein geverifieerd clean (dumb/wrappers, tekst via props). Residu = `settings/*` (2e-Claude). |
| **CFG-1** | P2 | M | BE+FE | NATIONALITIES/LANGUAGES/klant-STATUSES → tenant-lookups + i18n |
| **D-3** | P2 | M | BE+FE | "gearchiveerd bekijken + herstellen"-UI |
| **D-4/D-5** | P2 | S | BE+FE | tasks `/stats` + `/tasks/{id}/activity` |
| **R-SPLIT** | ✅ | — | FE | **VOLLEDIG OPGELOST — nul files >400 in de repo.** `ReportFilterSidebar` 485→216(+2) · `MessagesTable` 430→250(+2) · `fields` 403→124+290 · `WorkflowCanvasEditor` 907→**267** + ModulePicker/ConfigPanel/LogsPanel + `useWorkflowEditor`-hook. |
| **DUP-1** | P3 | S | FE | ✅ avatar-kleur 3× → `lib/avatarColor` |
| **A11Y-1** | P2 | M | FE | ~28 modals/drawers zonder focus-trap/`role=dialog`/`aria-modal`+restore (§6) — alleen `ChangelogPopover` heeft 't. Shared `Drawer`/`Modal`-shell met focus-trap. |
| **A11Y-2** | ✅ | — | FE | **OPGELOST.** Alle 10 resterende icon-only buttons kregen `aria-label` via `t('common:*')` (close/send/add/save/expand-collapse); `EntityHeader` kreeg `useTranslation` + hardcoded `aria-label="Close"` → `t('close')`; `common:` send/expand/collapse in 5 locales. Detector-restanten = buttons mét zichtbare tekst (false positives). |
| **ERR-1** | ✅ | — | FE | **OPGELOST.** Alle stille **mutatie**-catches → `notifyError(t('common:actionFailed'))` (customers/tasks/vacancies/opps/apps/ai + candidates: 10× in BackgroundTab/DocumentsSection/PoolsSection/CandidatesPage/CandidateTab). GET-loads blijven bewust soft (degraderen netjes). Gedeelde toast-infra (`lib/notify` + `Toaster`). |
| **F-8** | ◐ | L | FE | Inline `api.*`+`useEffect` → feature-hooks (§3). **Voortgang: 49 → ±46** (31 `.tsx` + 15 `.jsx`-settings). ✅ A1: customer-drawer ×4 · Matches · Opportunities · VacanciesPage · **CustomersPage** (data/record/bulk-hooks) · A2: UsersPage · WhatsAppPage · B: candidates ✅ · C: SM-reports. **Rest: A1 ~7 (applications/tasks — actief feature-gebouwd door andere instance) · A2 ~8 · C ~14 · B settings-`.jsx` 15.** `.tsx`-teller fluctueert: tasks/vacancies-buildout her-introduceert inline fetches. |
| **DUP-2** | P3 | S | FE | herhaalde className-shells (drawer ×10 · table ×7 · card ×6 · error-banner ×6) → extract; error-banner + card gebruiken rauwe Tailwind-kleuren i.p.v. `--color-*`-tokens (§4). |
| **F-12b** | P3 | L | FE | deep-relative-imports (`../../`, ~589 warnings) → `@/`-alias |
| ~~USE_MOCKS~~ | ✅ | — | — | DATA-API-zorg opgelost: `USE_MOCKS` is DEV-gated (`import.meta.env.DEV`), shipt nooit in prod. |

> **Positief bevestigd** (geen findings): geen `console.log` in commits · geen ongesanitiseerde dangerous HTML
> (`SafeHtml` saniteert) · geen hard-delete-call in FE (§8) · types zonder `any` in datamodellen.

### Runbook — workflow-sessie (turnkey, 1 gefocuste pass)

**Stap 1 — ✅ KLAAR: split `WorkflowCanvasEditor.tsx` 907 → 267 (panels + `useWorkflowEditor`-hook).**
Resterend van de workflow-sessie: alleen Stap 2 (i18n) + Stap 3 (harden). Originele split-map:
- `workflow/ModulePicker.tsx` ← `CATEGORY_ORDER` + `ModuleMetaEntry` + `ModulePicker` (~115r). Props: `{ insertAfterEdgeId, onSelect, onClose }`. Deps: `MODULE_META`/`MODULE_APP_MAP`/`useApps`.
- `workflow/ConfigPanel.tsx` ← `MANAGE_TABS` (export) + `ConfigPanel` (~145r). Deps: `MODULE_META`/`MODULE_SCHEMAS`/`FieldInput`/AI-tabs.
- `workflow/LogsPanel.tsx` ← `LogsPanel` (~95r). Deps: `api`/`runFormat`/`RunRow`. (Meest zelfstandig → eerst.)
- `workflow/useWorkflowEditor.ts` ← `EditorInner`-state + alle callbacks (`handleEdgeAdd/Delete/Filter`, `saveEdgeFilter`, `handleNodeRun`, `onConnect`, `insertModule`, `updateNodeConfig`, `deleteNode`, `handleSave`, `handleRun`, `nodesWithFirst`, `firstNodeId`) (~210r). Retourneert state + handlers.
- `WorkflowCanvasEditor.tsx` ← `EditorInner` JSX die de hook gebruikt + de 5 context-providers + `ReactFlowProvider`-wrapper (~280r).

**Stap 2 — I18N-1/2 (§5-compleet, 1 groene commit):** nieuwe `modules`-namespace (nl-bron + en/de/fr/es):
`labels.<type>` (~56) · `categories.<key>` (~16, key = slug van CATEGORY_ORDER) · `fields.<key>` (schema-veld-labels) ·
`actions.<key>` (Ophalen/Aanmaken/…) · `editor.*` (chrome: "Module kiezen"/"Opslaan"/"Laden…"/"Aan"/"Uit"/…).
Render: `MODULE_META`-bouw in `modules/index.ts` levert `type` als key; resolve labels/categories/fields **at render**
via `t('modules:…')`; **registry-strings blijven de nl-bron, géén twee-waarheden**. Wire de FieldInput-`field.label`
+ ScheduleModal + ModulePicker/ConfigPanel-chrome.

**Stap 2-VOORTGANG (i18n):** ✅ editor-chrome · ✅ `fields.tsx` · ✅ `fieldControls.tsx` (alle via
`t('workflows:editor.*'/'fields.*')`, 5 locales). ☐ rest = **`ModulePicker` + `ConfigPanel`** — die tonen
module-**labels + categorieën** → vereisen de registry-map hieronder.

**Turnkey module-map (nl-bron uit registry; vertaal en/de/fr/es; flat `modules.<type>` + `categories.<slug>`):**
```
type|nl-label|categorie          (53 modules · 16 categorieën)
advanced_parser|Geavanceerde verwerker|Tekst & Parsing      aggregator|Aggregator|Flow beheer
ai_agent|AI Agents|AI                                        ai_match|AI-kandidaatvoorstellen|Matches
applicant_event|Sollicitatie-event|Triggers                 applicant_message|Bericht naar sollicitant|Communicatie
applications|Sollicitaties|Sollicitaties                    candidates|Kandidaten|Kandidaten
condition|Voorwaarde / vertakking|Flow beheer               customers|Klanten|Klanten
delay|Wachttijd|Flow beheer                                 email_send|E-mail Sturen|Communicatie
error_break|Stoppen (Break)|Flow beheer                     error_commit|Vastleggen (Commit)|Flow beheer
error_ignore|Negeren|Flow beheer                            error_resume|Hervatten (Resume)|Flow beheer
error_rollback|Terugdraaien (Rollback)|Flow beheer          feeder|Data Invoer|Flow beheer
filter|Filter|Flow beheer                                   gateway_mail_hook|Mail Hook|Triggers
get_variable(s)|Variabele(n) ophalen|Flow beheer            html_parser|HTML Verwerker|Tekst & Parsing
html_table_parser|HTML-tabel verwerker|Tekst & Parsing      html_to_text|HTML naar tekst|Tekst & Parsing
hf_/sm_/intus_candidates|Kandidaten|HelloFlex/ShiftManager/Intus   hf_/sm_customers|Klanten|HelloFlex/ShiftManager
hf_/sm_/intus_shifts|Diensten|HelloFlex/ShiftManager/Intus   iterator|Iterator|Flow beheer
knowledge_search|Kennisbank Zoeken|AI                       matches|Matches|Matches
numeric_aggregator|Numeriek samenvoegen|Flow beheer         opportunities|Kansen|Kansen
planning|Diensten|Planning                                  repeater|Repeater|Flow beheer
router|Router|Flow beheer                                   set_variable(s)|Variabele(n) instellen|Flow beheer
shifts_input|Diensten Plakken|Planning                      sleep|Wachten|Flow beheer
table_aggregator|Tabel samenvoegen|Flow beheer              tasks|Taken|Taken
text_aggregator|Tekst samenvoegen|Flow beheer               text_parser|Tekst verwerker|Tekst & Parsing
vacancies|Vacatures|Vacatures                               wait|Wachten tot datum|Flow beheer
webhook|Webhook Trigger|Triggers                            whatsapp_send|WhatsApp Sturen|Communicatie
Categorieën: Alle·Triggers·Kandidaten·Sollicitaties·Vacatures·Matches·Kansen·Taken·Klanten·Planning·Communicatie·AI·ShiftManager·HelloFlex·Intus·Flow beheer·Tekst & Parsing
```
Wire: `ModulePicker`/`ConfigPanel` → `t('workflows:modules.'+type, meta.label)` + `t('workflows:categories.'+slug(cat), cat)`.

**Stap 3 — CLAUDE.md harden** naar master-standaard (na 0 FE-findings).

---

## D. Afgerond (archief)

- Workflow-builder (FE, 2026-07-01): **AI-Agent-module** herontworpen — 4 tabs (Standaard/Geavanceerd/Testen/
  Uitvoering), Claude Sonnet 4 default, **inline agent** (`connection`-picker + dode `agent_select` weg), live
  test-chat via `POST /ai/agents/test` (backend `AgentChatService` + endpoints klaar). **GESCHIEDENIS-tab** in de
  editor (DIAGRAM/GESCHIEDENIS-toggle; per-run + per-stap INPUT/OUTPUT via gedeelde `RunStepList`/`RunDetailDrawer`;
  de globale `RunsTable` hergebruikt nu dezelfde drawer). **Variabele-picker** (`{{module.veld}}` uit upstream
  test-run output, hybride bron + "hele output"-fallback). Router-persistentie (START-drag, 2 opslaan-knoppen,
  localStorage-brug). Backend-restpunten → **C-27-workflow** (runs-endpoint + token-substitutie).
- C-11 consent (FE, 2026-06-27): kanaal-consent omgezet naar het backend-contract — genest
  `consent.{whatsapp,email,newsletter}_opt_in` (was flat `*_consent`), defaults wa/e-mail aan
  (opt-out) + nieuwsbrief uit, `_consent_at` server-gestempeld (FE stuurt het nooit mee). Type +
  mapCandidate + buildCandidatePatch + CommunicationTab + tests bijgewerkt.
- C-16 changelog-IP (FE, 2026-06-27): `GET /candidates/{id}/activity` levert nu `subject_*` + `ip`;
  changelog-popover toont "Gewijzigd vanaf IP …" per entry (i18n in 5 locales). T3.3 (access-log
  filter) optioneel/niet gebouwd; C-23 owner-kleur vereiste geen actie.
- i18n-audit + parity-aanvulling (2026-06-27): de/fr/es waren ~1833 key-slots incompleet (5 hele
  namespaces + settings + partiële gaten) → stille NL-fallback in de switcher. Alle 5 locales nu **100%
  parity** (audit-script op 0). ⚠️ de/fr/es zijn **machine-vertaald** — aanrader: native reviewer laat
  applications/vacancies/tasks/opportunities/settings nalopen.
- Kandidaat-drawer herstructurering (sessie 2026-06-26): Documenten = eigen tab · Wijzigingslog =
  History-popover in de title-row · Taal→Achtergrond · Kandidaat-type→Voorkeuren · Laatste contact→
  Communicatie · Werk→"Match" (alleen bij match/sollicitatie) · dubbele sollicitatie-chips uit header ·
  ZZP-tab gekoppeld aan candidate-type `freelance` · Statistiek: Recente activiteit weg · ZZP-velden
  opgeschoond · Voorkeuren-refactor (één state: dagen/functie/branche/rijbewijs als chips/dropdown +
  loonheffing). Backend-restpunten → C-36.
- Tabelweergave instelbaar (Settings → Kandidaten → Tabelweergave): gekleurde labels aan/uit + avatar
  1-kleur vs. per-geslacht (fixt blauw-bug) · tabel-waarden uniform (alles zoals Functie). Backend → C-36.
- ShiftManager-pagina's op directe endpoints (`/sm_locations`, `/sm_departments`, `/sm_contacts`)
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
