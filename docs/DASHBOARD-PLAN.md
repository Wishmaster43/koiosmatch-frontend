# Dashboard-plan (B-27) — per-rol dashboards + nieuwe grafieken

> Werklijst om af te werken (niet in één keer bouwen). Elk blok = **component +
> data-need + backend-feed**. Doorklik verplicht op elke grafiek (`onNavigate(page,
> intent)`), filters zichtbaar toegepast op de doelpagina.

## Status
- ✅ Per-rol **templates** + **topbar-switcher** (dropdown, super-admin/management previewt alles; management = `'*'` = volledig dashboard, niks verborgen).
- ⚠️ **Nu verbergen de rollen alleen bestaande blokken** — de rol-specifieke *nieuwe* grafieken hieronder bestaan nog niet. Dat is de volgende bouwronde.

---

## 🟣 Management — ziet het meest (analytisch, tenant-breed)
- [ ] **Instroom ↔ Uitstroom / week** — netto pijplijn-gezondheid (gegroepeerde/divergerende bar). *Data: timeseries.in + .out.*
- [ ] **Invulgraad (fill rate)** — vervulde vs open vacatures (gauge + trend).
- [ ] **Funnel-conversie** — % drop-off per fase (applied→intake→hired), funnel met percentages.
- [ ] **Plaatsingen / maand × recruiter** — bar.
- [ ] **Time-to-fill / time-to-hire** — gem. dagen (KPI + trend).
- [ ] **Bron-effectiviteit** — source → hires (welke bronnen leveren op).
- [ ] **Kansen win/lost-ratio + pipeline-waarde per fase** — bestaande oppStage uitbreiden met waarde.
- [ ] **Bezettingsgraad** — utilization (planning-module, gated).
- [ ] **KPI's:** nieuwe intakes (week) · plaatsingen (week) · verlopen taken · pipeline-waarde.

## 🔵 Recruiter — "mijn werk" (operationeel)
- [ ] **Mijn funnel** — mijn sollicitaties per fase.
- [ ] **Mijn taken** — te laat / vandaag (lijst).
- [ ] **Mijn intakes deze week** — afspraken (mini-agenda/lijst).
- [ ] **Niet-gecontacteerd (mijn)** — op *laatste-contactdatum*.
- [ ] **Mijn conversie** — applied→hired.
- [ ] **KPI's:** mijn kandidaten · mijn open taken · mijn intakes vandaag.

## 🟢 Planner — planning-module
- [ ] **WhatsApp-wachtrij** — grootte + wachtend/gefaald (KPI + lijst). *(bestaat: `useWhatsAppQueue`)*
- [ ] **Incomplete workflow-runs** — gefaald/pending (lijst). *(bestaat: `ai_runs` met `ok=false`)*
- [ ] **Open shifts / onvervulde diensten** — telling + lijst.
- [ ] **Bezetting / dag-week** — bar.
- [ ] **Komende afspraken** — lijst.

## ⚪ Readonly
- [ ] Beperkte read-only KPI-strip + funnel (bestaand, geen nieuw werk).

---

## Doorklik & filters (alle grafieken)
- [ ] **tasks + opportunities**: `intent`-param toevoegen (worden nu genegeerd → dashboard-klik filtert niet).
- [ ] **Recente-lijst-rijen → drill-down**: `intent.open = id` → doelpagina roept z'n bestaande `selectX` aan (hergebruik, geen nieuw mechanisme). Recente kandidaat → kandidaat-drawer · recente sollicitatie → sollicitant-drawer · lead → klant-drawer · run → workflow-run · gesprek → WhatsApp.
- [ ] **Periode-klik**: datumveld-selector (**aangemaakt** / **laatste contact**) + range → lijst past `*_between` toe.
- [ ] **"Actief filter"-chiprij** bovenaan de lijst (klein gedeeld component) zodat een dashboard-sprong zichtbaar + wisbaar is.

## Settings (Fase 4)
- [ ] **Settings → Dashboards**: sub-tab per type + `ViewConfigEditor` (blok aan/uit + volgorde) + **live preview** (`<Dashboard viewType>` in een frame) + **rol → type-mapping**.
- [ ] **RolesSettings**: "Startdashboard"-dropdown per rol (`dashboard_type`, precedentie `management > recruiter > planner > readonly`).

---

## 🔧 Backend-handoff (relay)
- [ ] **`last_contact_at` + `last_contact_type` auto-vullen** bij ELK contact-event: e-mail · afspraak · WhatsApp zakelijk · WhatsApp privé · notitie · belafspraak · Google Meet. Elk event "touch't" de kandidaat (datum + kanaal).
- [ ] **Uitstroom-timeseries**: `/dashboard` → `charts.timeseries.out.{candidates_out, applications_rejected, matches_ended}` (+ netto). Definitie: kandidaat → niet-beschikbaar/gearchiveerd · sollicitatie → afgewezen · match → beëindigd.
- [ ] **Rol-gescopte feed**: `/dashboard?type=recruiter` = "mijn" data (`owner_id=me`); management = tenant-breed. Backend honoreert de caller-rol.
- [ ] **Nieuwe metrics**: fill-rate · plaatsingen-count · intakes-count · time-to-fill · source→hires · WA-queue-count · incomplete-runs-count · bezettingsgraad.
- [ ] **Datumveld-filter** op lijst-endpoints: `created_between` én `last_contact_between`.
- [ ] **Bevestig `dashboard_type`-enum** (C-35): `management · recruiter · planner · readonly` — FE gebruikt exact deze.
