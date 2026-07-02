# KOIOS MATCH — Review-taken (Danny walkthrough 2026-07-02) — execution-ready

> Uitvoerbare hand-off van Danny's review-punten voor de **andere FE-lanes** (dashboard/settings/vacancies/
> applications/workflow). Tracked als **`worklist.md §B-32..B-38`** + **`ACTION-PLAN §I` (AP-R1..R6)** — dit is de
> *doe-versie* met bestand + te-spiegelen-patroon + acceptatie. Prio-2 (na prio-1). Commit met **expliciete pathspec**
> (gedeelde index → geen `git add -A`).

---

## Settings-lane (`src/pages/settings/`)

### T1 · `billing_pay` verwijderen (B-32)
- **Waar:** `settings/registry.jsx` (rond r.236-239, het `billing`-blok / `billing_pay`-tab).
- **Doen:** de `billing_pay`-sub-tab weghalen — geen billing-functionaliteit, "doen we niks mee".
- **Acceptatie:** geen `#billing/billing_pay`-route meer; geen dode i18n-keys.

### T2 · Ontbrekende personalisatie-sub-tabs (B-32)
- **Waar:** `settings/registry.jsx` + een sub-tab-component per entiteit (spiegel `CandidateLookupsSettings` / de Contractvorm-editor).
- **Doen:** sub-tabs toevoegen voor **Taken** (lookups `task-statuses/-types/-priorities` bestaan al → alleen ontsluiten via `StatusListEditor`), **Bellijsten/Outreach** (kanaal- + per-target-status-lookup), **Matches** (min. tabelweergave-kleurtoggles; het match-**profiel** leeft op de vacature (K-26) → verwijs, niet dupliceren).
- **Acceptatie:** elke entiteit heeft dezelfde Settings-surface als kandidaten (blueprint §3A); lookups laden via `useX()` met seed-fallback.

### T3 · Optioneel `icon`/`emoji`-veld op lookups (B-32) — *wacht op BE-kolom (AP-R2)*
- **Waar:** de gedeelde lookup-editor (`StatusListEditor`) + waar lookups getoond worden (chips/pills naast het label).
- **Doen:** emoji-picker naast de bestaande `color`; toon het icoon **naast** het label (nooit icon-only, a11y). Sterk voor `last-contact-types` + `task-types`; **genders = terughoudend** (kleur draagt het al — Danny beslist).
- **Acceptatie:** tenant zet per waarde een emoji; verschijnt in tabel + drawer naast de tekst.

## Vacancies-lane (`src/pages/vacancies/`)

### T4 · Kandidaten-tab: sub-tabs sticky (B-37)
- **Doen:** in de vacature-drawer, tab **Kandidaten**, de sub-tabs een **sticky sub-header** maken (blijven staan bij scroll). Spiegel waar de kandidaat-drawer dit al doet (`position: sticky; top: …` op de sub-tab-balk).
- **Acceptatie:** scrollen in de kandidaten-tab houdt de sub-tabs zichtbaar.

### T5 · "Details"-tab overbodig? (B-38)
- **Doen:** check overlap van de **Details-tab** met de header + andere tabs. Waarschijnlijk de kern-vacaturevelden in de **primaire tab** vouwen (mirror kandidaat "Profiel") óf de tab schrappen als 'ie het kopje dupliceert.
- **Acceptatie:** geen redundante Details-tab; velden hebben één logische plek.

## Workflow-lane (`src/pages/ai/WorkflowsPage` + folders-UI)

### T6 · Tabel-weergave (B-33)
- **Doen:** view-toggle **kaarten ⇄ tabel** met **sticky header** + **sorteeropties** (spiegel de gedeelde `DataTable` / de Matches/Tasks board-toggle). Kolommen: naam · status · map · laatste run · #runs.
### T7 · Autorisatie op álle acties (B-33) — *BE gate't al op `settings.update` (AP-H1)*
- **Doen:** map **aanmaken/hernoemen/verwijderen** · workflow **aanmaken/wijzigen/runnen** · **logs bekijken** → **verberg/disable** wat de user niet mag (`hasPermission('settings.update'/'settings.view')`). Nooit alleen client-side vertrouwen.
### T8 · Verwijder-guard (B-33) — *BE levert de 409*
- **Doen:** map/workflow verwijderen → toon de backend-**409 + reden** ("kan niet: nog actieve workflow(s)") netjes, geen harde error.

## Dashboard-lane (Dash) (`src/pages/dashboard/`)

### T9 · Pijplijnwaarde-eenheid €/uren (B-34) — *wacht op BE `pipeline_value_unit` (AP-R4)*
- **Doen:** toon de pijplijnwaarde in de **door de API meegegeven `unit`** (€ of uren) met het juiste format/label; **hardcode geen €**. Settings → Dashboards krijgt de toggle.
- **Acceptatie:** wisselt tussen € en uren zonder FE-codewijziging (leest de unit).

## Cross-cutting (alle entiteitpagina's + BE)

### T10 · Super-search boven de tabel (B-35) — *BE: server-side `?q=` volledige dekking*
- **Doen:** één gedeelde search in de **page-header** (bij de titel — links/centraal), consistent over candidates · applications · vacancies · matches · opportunities · tasks · customers · SM. Uit het rechter filterpaneel halen (of spiegelen). Debounced → server-side `?q=`.
- **Acceptatie:** zelfde plek/gedrag op elke pagina; doorzoekt alle velden + sub-entiteiten (naam/telefoon/e-mail/functie/werkervaring/notities).

## Applications-lane (`src/pages/applications/`)

### T11 · Kandidaat voorstellen aan klant (B-36) — *FE+BE, Danny's a/b-keuze*
- **Doen:** prominente actie **"Voorstellen / Mail opdrachtgever"** in de sollicitatie-drawer (bovenaan, niet onderaan naast Ontkoppelen): kies **klant-contactpersoon** → e-mail met **geanonimiseerde CV** + **templated tekst**.
- ⚠️ `mailto:` kan **geen bijlage** → **backend verstuurt** (aanbevolen, trackbaar) via `POST /applications/{id}/propose`, of mailto + CV-downloadlink. **Wacht op Danny's a/b + het BE-endpoint.**

---

_Elke taak: TypeScript · één EN-comment/blok · i18n ×5 · tokens (§4) · gedeelde componenten hergebruiken · lint schoon._
