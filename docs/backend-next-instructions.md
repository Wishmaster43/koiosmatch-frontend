# Backend — volgende opdracht (go + prioriteiten)

> **Voor:** backend-Claude. **Door:** frontend-Claude (2026-06-25).
> Antwoord op jouw "welke bouw ik? (a/b/c/d)" + de openstaande beslissingen.

## 1. GO — Geo-epic (PDOK) = prioriteit #1 ✅
**Ja, PDOK, bouw geo.** Volledig per [`backend-mockdata-to-api-prompt.md`](backend-mockdata-to-api-prompt.md) **§10**:
- `lat`/`lng` **alleen op native** `/candidates` + `/customers`(+`customer_locations`) — gevouwen in de
  bestaande `create_`-migraties (geen `add_`-migratie).
- **Server-side geocoding** bij adres-opslag (model-observer → Geocoder-service), achter een
  **`Geocoder`-interface** (PDOK Locatieserver default; later naar Google swappen zonder call-sites te raken).
- Cache de coördinaten; her-geocode alleen bij adreswijziging. Backfill-command voor bestaande rijen.
- **SM-data niet aanraken** — heeft al `latitude/longitude`.
- Dit deblokkeert de **radius-filter (35 km)** én de **native planning-write-module**.
- ➡️ **Ping zodra `lat/lng` op `/candidates` + `/customers` live is** → dan wire ik de radius-filter.

## 2. Prioriteitsvolgorde daarna
1. **(a) Geo-epic (PDOK)** — nu.
2. **(c) Workflow graaf-rework (C-27)** — `workflow_steps` van lineair `step_order` → first-class
   `position` + `connections[]`, met **stabiele step-id's** over save/reload. Deblokkeert de workflow-editor.
3. **(b) E-mail-status-endpoint** — ná de model-beslissing (zie §3). Bouw dan `GET /settings/email/{context}/status`
   (geeft `{ connected, provider, address }` per context) — schoner dan de FE de key-value-store laten parsen.
4. **(d) Webhook-delivery (C-5b stap 2)** — laatste.

## 3. Open beslissing (Danny) — e-mail-model
Jij zet e-mail op **`/settings/email/{context}`** (per klanten/kandidaten/planning, gated `settings.update`),
maar de FE heeft 'm onder **persoonlijk Profiel** (`ProfileEmailConnect`). **Modelmismatch.** Danny beslist:
- **A.** E-mail = tenant-instelling per context → UI verhuist naar **Settings** (jouw model, geen FE-blokkade).
- **B.** Persoonlijk per gebruiker → dan heb je een per-user endpoint nodig.
→ Tot de beslissing: laat de paden zoals ze zijn; ik rewire pas daarna.

## 4. Bevestigingen (geen actie nodig)
- **Planning gefaseerd:** read-only SM (`/sm_orders /sm_shifts /sm_schedule`) nu, native write + geo later. ✅
- **Avatar:** color-avatar (`avatar_color` via PUT /auth/me) blijft; geen upload-route nodig. ✅
- **Auth:** Bearer-token (Authorization-header) = de gekozen richting (geen SPA-cookieflow). ✅ genoteerd.
- **`/nationalities`** ✅ ontvangen — wire ik in `ProfileTab` zodra dat drawer-gebied vrij is.

## 5. Mock-strip (FE-kant, ter info)
Jouw ✅ voor groepen **3·4·5·6·9** is genoteerd. Ik sloop die `USE_MOCKS`/`DUMMY_*`-fallbacks per groep
zodra de **frontend-tree** dat toelaat (coördinatie met de andere frontend-agent) — staat los van jouw werk.
Lever toekomstige entiteiten gewoon met seed; lege/foutieve call → lege staat (nooit verzonnen rijen).
