# Prompt voor Backend Claude — API-keys (scoped) + Uitgaande webhooks (events)

## Context
De frontend (koiosmatch-frontend, `main`) heeft twee Instellingen-secties onder
**Integraties** uitgebouwd: **API-keys** (scoped credentials voor externe
koppelingen, model zoals ShiftManager) en **Uitgaande webhooks** (event-
abonnementen die KoiosMatch naar een externe endpoint pusht). De UI is af en draait
nu tegen lege/fallback-data; de endpoints hieronder bestaan nog **niet** (geprobed:
`GET /api-keys` → 404, `GET /webhook-subscriptions` → 404, `GET /webhook-events` →
404). Bouw de API-kant zodat die 404's 200 worden.

Alles is **tenant-scoped** en raakt **special-category data (AVG/gezondheid)** —
behandel sleutels en payloads navenant. Werk alleen aan deze feature. Houd
**snake_case** in de API (de frontend stuurt en leest snake_case). De frontend
normaliseert lijsten via een adapter die zowel een bare array als `{ data, meta }`
accepteert; detail-responses mogen een bare object of `{ data: {...} }` zijn.

> **Niet breken:** de bestaande inkomende `/webhooks` (token-URL → workflow-trigger,
> gebruikt door de workflow-editor) blijft ongewijzigd. De nieuwe uitgaande
> abonnementen leven op een **apart pad**: `/webhook-subscriptions`.

---

## 1. API-keys — scoped credentials

### Tabel `api_keys` (tenant-scoped)
| kolom | type | opmerking |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid/fk | |
| `friendly_name` | string | verplicht |
| `type` | enum | `primary` \| `additional` |
| `organisation` | string null | |
| `description` | text null | |
| `guid` | string uniek | **publieke** key-id (niet geheim, toonbaar) |
| `secret_hash` | string | **alleen hash** (bcrypt/argon2 of sha256+pepper) |
| `status` | enum | `active` \| `disabled` |
| `contact_name` | string null | |
| `contact_email` | string null | |
| `allowed_ips` | json null | array van IPv4/IPv6 **of** CIDR (`/24`, `/64`). Leeg = geen restrictie |
| `last_used_at` | timestamp null | |
| `created_at` / `updated_at` | timestamps | |

### Tabel `api_key_scopes` (of JSON-kolom `scopes`)
Per entiteit een niveau. De frontend stuurt/leest een **map** `{ entity: level }`
waarin alleen ingeschakelde entiteiten voorkomen.

- **entiteiten (slugs):** `candidates, customers, locations, departments,
  contact_persons, vacancies, applications, orders, shifts, shift_schedulings,
  contracts, documents, reporting`
- **niveau:** `read` \| `read_write` (afwezig = geen toegang)

### Endpoints (auth: ingelogde gebruiker + `permission:settings.manage` o.i.d.)
```
GET    /api-keys
  → 200 [ { id, friendly_name, status, type, organisation, guid,
            created_at, updated_at } ]            # lijst, GEEN secret

POST   /api-keys
  body { friendly_name, type, organisation?, description?,
         contact_name?, contact_email?, allowed_ips?[],
         scopes?: { <entity>: "read"|"read_write" } }
  → 201 { id, friendly_name, type, organisation, description, guid,
          status, contact_name, contact_email, allowed_ips,
          scopes, created_at, updated_at, secret }   # secret = plaintext, 1×

GET    /api-keys/{id}
  → 200 { ...zelfde velden als hierboven, scopes, allowed_ips,
          contact_name, contact_email }            # GEEN secret

PUT    /api-keys/{id}
  body (elk veld optioneel) { friendly_name, type, organisation, description,
         contact_name, contact_email, allowed_ips[], status, scopes }
  → 200 { ...updated }                              # GEEN secret-wijziging hier

DELETE /api-keys/{id}                               # intrekken (soft of hard; documenteer)

POST   /api-keys/{id}/regenerate
  → 200 { secret }                                  # nieuw plaintext secret, 1×; oude vervalt
```

### Authenticatie mét de key (inbound API-gebruik door de externe partij)
- Accepteer de key via header — kies **één** en documenteer, bv.
  `Authorization: Bearer <guid>.<secret>` of `X-Api-Key: <guid>.<secret>`.
  Verifieer `secret` tegen `secret_hash`.
- **IP-whitelist**: als `allowed_ips` niet leeg is, eis dat het bron-IP matcht
  (inclusief CIDR), anders 403.
- **Scope-enforcement**: GET vereist `read` of `read_write` op de entiteit;
  POST/PUT/PATCH/DELETE vereist `read_write`. Geen scope → 403.
- `last_used_at` bijwerken (throttled). `status=disabled` → 401/403.
- **Nooit** het plaintext secret loggen.

### Audit
Log create/update/regenerate/revoke + scope-wijzigingen in de bestaande audit-log
(categorie `apikeys`), **zonder** secret/PII.

---

## 2. Uitgaande webhooks — event-abonnementen

### Tabel `webhook_subscriptions` (tenant-scoped)
| kolom | type | opmerking |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid/fk | |
| `name` | string | verplicht |
| `url` | string | https (valideer https in prod) |
| `status` | enum | `active` \| `disabled` |
| `signing_secret_hash` | string | voor **HMAC-SHA256**; plaintext 1× tonen |
| `event_types` | json | array van event-keys (zie catalogus) |
| `last_triggered_at` | timestamp null | |
| `created_at` / `updated_at` | timestamps | |

Optioneel `webhook_deliveries`: `id, subscription_id, event_type, payload_hash,
response_status, attempt, delivered_at` — voor retries/observability.

### Event-catalogus (exact deze keys gebruikt de frontend)
```
candidate.created            candidate.updated            candidate.deleted
candidate.status_changed     candidate.funnel_type_changed
customer.created             customer.updated             customer.deleted
location.created             location.updated             location.deleted
contact_person.created       contact_person.updated       contact_person.deleted
vacancy.created              vacancy.updated              vacancy.deleted
order.created                order.updated                order.deleted
shift.created                shift.updated                shift.deleted
shift.scheduling.created     shift.scheduling.updated     shift.scheduling.deleted
```
Afgestemd met Danny:
- `candidate.status_changed` en `candidate.funnel_type_changed` zijn **aparte**
  events bovenop `candidate.updated` (gerichte abonnementen). Emit het specifieke
  event én eventueel `updated` — kies één lijn en documenteer.
- `shift` heeft `created/updated/deleted` (géén aparte `changed`).
- `shift.scheduling.*` payload bevat `scheduling_type`: `schedule_in` (inplanning)
  of `schedule_out` (uitplanning).

### Endpoints
```
GET    /webhook-events
  → 200 [ { key: "candidate.created", group: "candidate" }, … ]   # catalogus (bron v. waarheid)

GET    /webhook-subscriptions
  → 200 [ { id, name, url, status, event_types[], last_triggered_at } ]   # GEEN secret

POST   /webhook-subscriptions
  body { name, url, event_types[] }
  → 201 { id, name, url, status, event_types, created_at, secret }   # secret 1×

GET    /webhook-subscriptions/{id}
  → 200 { id, name, url, status, event_types[], last_triggered_at }

PUT    /webhook-subscriptions/{id}
  body (elk veld optioneel) { name, url, status, event_types[] }
  → 200 { ...updated }

DELETE /webhook-subscriptions/{id}

POST   /webhook-subscriptions/{id}/regenerate-secret
  → 200 { secret }                                   # nieuw plaintext secret, 1×
```
> De frontend heeft een statische fallback-catalogus, maar `GET /webhook-events`
> blijft de bron van waarheid — houd de lijst identiek.

### Aflevering (delivery)
- Bij elk domein-event: vind actieve subscriptions van de tenant waarvan
  `event_types` het event bevat; **queue** een delivery (async, niet in de request).
- **Payload** (JSON): `{ id, type, created_at, tenant_id, data: {…} }` —
  `data` = minimale, niet-gevoelige representatie (AVG-dataminimalisatie; géén
  BSN/gezondheidsdetails tenzij strikt nodig).
- **Signing**: headers `X-Koios-Signature: sha256=<hmac(body, signing_secret)>`,
  `X-Koios-Event: <type>`, `X-Koios-Delivery: <uuid>`.
- **Retries**: exponential backoff (bv. 5 pogingen), resultaat loggen; na max →
  failed (optioneel auto-disable na X opeenvolgende fails). Timeout 5–10s,
  redirects niet volgen.
- **SSRF-bescherming**: blokkeer interne/loopback/link-local IP-ranges als doel-URL.

### Audit/privacy
- Nooit volledige payload met PII loggen; bewaar hooguit hashes/metadata.
- Audit subscription-CRUD (categorie `webhooks`).

---

## Samengevat
1. Migraties: `api_keys`, `api_key_scopes` (of `scopes` JSON), `webhook_subscriptions`,
   (optioneel) `webhook_deliveries`.
2. API-key auth-guard: header-parsing, hash-check, IP/CIDR-whitelist,
   scope-enforcement, `last_used_at`.
3. Event-dispatch + queued delivery met HMAC-signing + retries + SSRF-guard.
4. `GET /webhook-events` catalogus-endpoint (identiek aan bovenstaande lijst).
5. Audit-logging (apikeys/webhooks) zonder secrets/PII.
6. Seeder: een voorbeeld-API-key (disabled) zodat de lijst niet leeg is.

> Documenteer de gekozen header-conventie, soft/hard-delete, en de
> status-changed / funnel-changed emit-lijn in de API-docs zodat de frontend
> exact aansluit. De frontend stuurt scopes als map `{ entity: "read"|"read_write" }`
> en webhook-events als array van bovenstaande keys.
