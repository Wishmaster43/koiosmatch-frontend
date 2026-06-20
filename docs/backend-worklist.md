# Backend-worklist — KoiosMatch

Eén bron voor al het **openstaande** backend-werk. Afgeronde prompts zijn opgeruimd;
hun resultaat staat onderaan onder "✅ Afgerond". Conventies: **snake_case** in de API,
tenant-scoped, AVG/special-category (gezondheid) — behandel data navenant. Lijst-
responses mogen een bare array of `{ data, meta }` zijn; detail bare object of `{ data }`.

Status gepeild op `koiosmatch-api.test` (401 = bestaat, 404 = nog te bouwen).

---

## ☐ 1. Lookups — "in gebruik"-beveiliging + demo-data

Routes bestaan (401). Nog te doen:

- [ ] **`in_use`-vlag** in élke lookup-GET zodat de frontend de prullenbak op slot zet:
  ```json
  { "id": 3, "label": "Vrouw", "color": "#E06C9F", "in_use": true }
  ```
  Frontend leest `in_use ?? is_used ?? locked ?? usage_count > 0`. Geldt voor:
  **genders, languages, language-levels, pools, candidate-lookups (types/funnel/
  statuses), candidate-rejection-reasons, vacancy-statuses, vacancy-phases,
  vacancy-custom-fields**. "In gebruik" = ≥1 record verwijst ernaar (`exists()`).
- [ ] **`DELETE` op in-gebruik-item → HTTP 409** (niet 500). Frontend vangt 409 en
  laat de rij staan + markeert 'm.
- [ ] **Demo-data (seeder)** met kleur + `sort_order`, een paar als `in_use`:
  - Talentenpools (`/pools`): *Flexpool Zorg, Spoed/ad-hoc, Alumni,
    Inzetpool Planning* (laatste `context: 'planning'`, rest `recruitment`).
  - Vacancy-statuses: *Concept, Open, On hold, Vervuld, Gesloten*.
  - Vacancy-phases: *Intake, Werving, Voordracht, Plaatsing*.
- [ ] Bevestig dat vacancy status/fase **toevoegen + reorder** werkt met ingelogde sessie
  (routes geven nu 401 i.p.v. eerdere 404/500).

---

## ☐ 2. Kandidaat sub-entiteiten — body-contracten bevestigen

Routes (per kandidaat): `POST /candidates/{id}/{rel}` · `PATCH …/{rel}/{eid}` ·
`DELETE …/{rel}/{eid}`. Na `POST` het record incl. `id` teruggeven (`{data}` of plat);
de frontend vervangt z'n tijdelijke negatieve id door de server-`id`. Zet deze velden
in de FormRequest/`$fillable` of hernoem de kolommen ernaar:

- [ ] **experiences** — `function_title, employer, location, start_date, end_date, current (bool), description`
- [ ] **educations** — `title, school, start_date, end_date, in_progress (bool), description, issue_date`
- [ ] **certifications** — `name, organisation, issue_date, expiry_date, license_number, description`
- [ ] **skills** — `name, level`
- [ ] **matches** *(was "placements")* — `client, function_title, scale, step, hourly_rate, hours_per_week, start_date, end_date, contract_type, contract_duration`
  - **Hernoem relatie/route naar `matches`.** Frontend gebruikt `/candidates/{id}/matches`,
    leest GET-detail `matches: [...]` (met `placements` als tijdelijke fallback) en `stats.matches_count`.
- [ ] **languages** — hele array in `PATCH /candidates/{id}`: `{ languages: [{ language, spoken, written }] }`
- [ ] **preferences** — nested in `PATCH /candidates/{id}`: `{ available_from, hours_per_week, preferred_days, max_travel_km, max_travel_min, has_license (bool), own_transport (bool), function_pref, sector_pref, min_rate, contract_pref, remarks }`
- [ ] **zzp** — nested: `{ company_name, kvk_number, vat_number, kor (bool), intracommunautair (bool), street, house_number, postal_code, city, country, creditor_number, business_email, invoice_email, iban, self_billing (bool), payment_discount, mediation_costs, payment_term }`

---

## ☐ 3. Kandidaat — Documenten (multipart upload)

Frontend uploadt nu echte bestanden. Nog te bouwen:

- [ ] **`POST /candidates/{id}/documents`** — `multipart/form-data`: `file` (binary),
  `type` (string), `name`. → `{ id, name, type, size, url }` (`url` = inline/download-link).
- [ ] **`PATCH /candidates/{id}/documents/{docId}`** — `{ name }` (hernoemen).
- [ ] **`DELETE /candidates/{id}/documents/{docId}`**.
- [ ] GET-detail levert `documents: [{ id, name, type, size, url }]`.
- AVG: niet publiek serveren, alleen geautoriseerde tenant-gescoped link; mime/grootte server-side valideren.

---

## ☐ 4. Kandidaat — Branches (kandidaat ↔ klant/vestiging)

Het "Vestiging"-blok koppelt een kandidaat aan klanten uit `GET /crm/customers`.
Frontend wacht op het contract (bewust niet gegokt — ids vs namen):

- [ ] Kies + documenteer: **`POST /candidates/{id}/branches`** `{ customer_id }` +
  **`DELETE /candidates/{id}/branches/{customerId}`**, GET-detail `branches: [{ id, name }]`.
- [ ] Laat de gekozen key (`customer_id` of `branch_id`) + of het een pivot is weten;
  dan draait de frontend het Vestiging-blok in één edit om naar persisteren.

---

## ☐ 5. Integraties — API-keys (scoped) + Uitgaande webhooks

UI is af, draait op fallback-data. Endpoints geven **404** — bouwen.
Alles tenant-scoped, special-category data; secrets nooit loggen.

> **Niet breken:** de bestaande inkomende `/webhooks` (token-URL → workflow-trigger)
> blijft ongewijzigd. Nieuwe uitgaande abonnementen op apart pad `/webhook-subscriptions`.

### 5a. API-keys

**Tabel `api_keys`** (tenant-scoped): `id (uuid)`, `tenant_id`, `friendly_name`,
`type` (`primary|additional`), `organisation?`, `description?`, `guid` (publiek key-id),
`secret_hash` (**alleen hash**), `status` (`active|disabled`), `contact_name?`,
`contact_email?`, `allowed_ips?` (json: IPv4/IPv6 of CIDR; leeg = geen restrictie),
`last_used_at?`, timestamps.

**Scopes** — map `{ entity: level }`, alleen ingeschakelde entiteiten.
Entiteiten: `candidates, customers, locations, departments, contact_persons,
vacancies, applications, orders, shifts, shift_schedulings, contracts, documents,
reporting`. Niveau: `read | read_write` (afwezig = geen toegang).

```
GET    /api-keys            → [ { id, friendly_name, status, type, organisation, guid, created_at, updated_at } ]  (GEEN secret)
POST   /api-keys            body { friendly_name, type, organisation?, description?, contact_name?, contact_email?, allowed_ips?[], scopes?{entity:level} }
                            → 201 { ...velden, guid, scopes, allowed_ips, secret }   (secret = plaintext, 1×)
GET    /api-keys/{id}        → { ...velden, scopes, allowed_ips, contact_* }          (GEEN secret)
PUT    /api-keys/{id}        body (alles optioneel) { friendly_name, type, organisation, description, contact_*, allowed_ips[], status, scopes } → { ...updated }
DELETE /api-keys/{id}        (intrekken; soft/hard documenteren)
POST   /api-keys/{id}/regenerate → { secret }   (nieuw plaintext, 1×; oude vervalt)
```

**Inbound auth met de key:** header `Authorization: Bearer <guid>.<secret>` óf
`X-Api-Key: <guid>.<secret>` (kies één, documenteer); verifieer tegen `secret_hash`.
IP-whitelist (incl. CIDR) anders 403. Scope-enforcement: GET → `read`, schrijf →
`read_write`, anders 403. `last_used_at` throttled bijwerken; `disabled` → 401/403.
Audit (categorie `apikeys`) zonder secret/PII.

### 5b. Uitgaande webhooks

**Tabel `webhook_subscriptions`** (tenant-scoped): `id`, `tenant_id`, `name`, `url`
(https), `status` (`active|disabled`), `signing_secret_hash` (HMAC-SHA256; plaintext 1×),
`event_types` (json), `last_triggered_at?`, timestamps. Optioneel `webhook_deliveries`
voor retries/observability.

**Event-catalogus (exacte keys):**
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
- `candidate.status_changed` / `…funnel_type_changed` zijn **aparte** events bovenop
  `candidate.updated`. `shift.scheduling.*` payload bevat `scheduling_type`:
  `schedule_in` | `schedule_out`.

```
GET    /webhook-events           → [ { key, group } ]   (catalogus = bron van waarheid)
GET    /webhook-subscriptions    → [ { id, name, url, status, event_types[], last_triggered_at } ]  (GEEN secret)
POST   /webhook-subscriptions    body { name, url, event_types[] } → 201 { ...id, status, secret }   (secret 1×)
GET    /webhook-subscriptions/{id} → { id, name, url, status, event_types[], last_triggered_at }
PUT    /webhook-subscriptions/{id} body (optioneel) { name, url, status, event_types[] } → { ...updated }
DELETE /webhook-subscriptions/{id}
POST   /webhook-subscriptions/{id}/regenerate-secret → { secret }   (1×)
```

**Aflevering:** bij elk domein-event actieve subscriptions matchen → **queue** delivery
(async). Payload `{ id, type, created_at, tenant_id, data:{…} }` (dataminimalisatie,
geen BSN/gezondheid tenzij strikt nodig). Signing headers `X-Koios-Signature:
sha256=<hmac>`, `X-Koios-Event`, `X-Koios-Delivery`. Retries met backoff (±5),
timeout 5–10s, geen redirects, **SSRF-guard** (blokkeer interne/loopback/link-local).
Audit (categorie `webhooks`) zonder PII. Seeder: 1 voorbeeld-API-key (disabled).

---

## ✅ Afgerond (ter context, niet meer doen)

- **Pools** — 9 endpoints + seeder; kleuren via API. (`/pools` 401)
- **Soft colors** — recolor-migratie naar zacht palet (geen reseed nodig).
- **Kandidaat-detail migraties** — `experiences.current`, `educations.{school,end_date,in_progress,description}`,
  `users.avatar_color`, lookup-tabellen `genders` (value/label/color), `languages`, `language_levels`.
- **18 sub-entiteit-routes** (experiences/educations/certifications/skills/languages/placements)
  + lookup-routes voor genders/languages/language-levels. (401)
- **Vacancy-routes** bestaan nu (waren 404/500 → 401). Functioneel testen staat in §1.
