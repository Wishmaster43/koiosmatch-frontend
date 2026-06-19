# Prompt voor Backend Claude — Talentenpools, Koios-advies & last_contact

## Context
De frontend (koiosmatch-frontend, `main`) heeft de kandidaten-UI uitgebreid met **talentenpools**, een **Koios-advieskolom** en **bulk-acties**. Alles is nu klaar-voor-data met nette fallback. Bouw de API-kant: **migraties + modellen + endpoints + resources + seeder**. Werk alleen aan deze feature.

### Auth
Bearer-token (of cookie-modus); super-admins sturen `X-Tenant`. Base path `/api`. Alles tenant-scoped (database-per-tenant).

---

## ⚠️ Belangrijk: "pool" is overladen — houd dit uit elkaar
1. **Funnelfase "Actieve pool"** — levensfase van de kandidaat (`funnel_type='pool'`). *Bestaat al, niet aanraken.*
2. **Talentenpool** (recruitment) — benoemde lijst kandidaten. **Dit bouwen we nu.**
3. **Planning-/inzetpool** — wie inzetbaar is op shifts. **Toekomstig, eigen Planning-module.** Nu alleen **reserveren**.

> **ShiftManager ≠ planning.** ShiftManager is **puur rapportage** (sync van `sm_candidates`). Koppel pools daar **niet** aan vast. Het echte Planning-systeem (**Orders → Shifts → Scheduled**, eigen inzetpool, globale functies) komt later en bouwen we zelf.

### Aanpak: één `pools`-tabel met een `context`-kolom
- `context ∈ ('recruitment' | 'planning')`. Nu bouwen we alleen `recruitment`; `planning` is gereserveerd voor de toekomstige Planning-module.
- Dezelfde `candidate_pool`-pivot werkt straks voor beide soorten (context zit op de pool). Een kandidaat kan in beide.
- De frontend stuurt bij het aanmaken het gekozen `context` mee (zie instellingenscherm).
- **Functies ≠ pools.** Globale planning-functies (rollen waarop je inplant: Verzorgende IG, Helpende…) worden later een **aparte lookup**, geen pool. Nu niet bouwen, wél in je achterhoofd houden.

---

## Migraties / databases (nog te maken)
```
pools
  id (uuid)            tenant_id
  context              enum/string  -- 'recruitment' | 'planning'  (default 'recruitment')
  name                 string
  color                string nullable
  description          text nullable
  type                 enum/string  -- 'static' | 'dynamic' | 'ai'  (default 'static')
  criteria             json nullable   -- voor dynamic (saved-search filters)
  owner_id             uuid nullable
  sort_order           int default 0
  active               bool default true
  timestamps

candidate_pool   (pivot, many-to-many)
  id (uuid)
  pool_id              fk -> pools
  candidate_id         fk -> candidates
  source               enum/string  -- 'manual' | 'dynamic' | 'koios'  (default 'manual')
  status               enum/string  -- 'active' | 'suggested'          (default 'active')
  score                decimal nullable   -- AI-match score
  reason               string nullable    -- AI-onderbouwing
  added_by             uuid nullable
  added_at             timestamp
  unique(pool_id, candidate_id)

candidates  (kolom toevoegen)
  koios_advice         json nullable
    -- { action: 'add_to_pool'|'contact'|'plan_intake'|'none', label?, reason?, score?, pool_hint? }
```

---

## Endpoints (de frontend roept deze al aan)

### Pool-CRUD (instellingenscherm — naam + kleur + soort + reorder)
- `GET    /pools?context=recruitment` → `[{ id, name, color, type, context }]` (default `recruitment` als geen context)
- `POST   /pools` body `{ name, color, context }`  → 201 `{ id, name, color, context, type }`
- `PUT    /pools/{id}` body `{ name?, color?, ... }`
- `DELETE /pools/{id}`  (in gebruik → archiveer `active=false`)
- `PUT    /pools/reorder` body `{ ids: [...] }`

### Lidmaatschap (drawer + bulk)
- `POST   /candidates/{id}/pools` body `{ pool_id }`            — toevoegen (`source=manual,status=active`)
- `DELETE /candidates/{id}/pools/{poolId}`                       — verwijderen
- `POST   /pools/{poolId}/candidates` body `{ candidate_ids: [] }`   — **bulk toevoegen**
- `DELETE /pools/{poolId}/candidates` body `{ candidate_ids: [] }`   — **bulk verwijderen**

---

## In de candidate-resources meesturen (list **én** detail)
- `pools: [{ id, name, color, source }]` — alleen `status='active'`.
- `koios_advice: { action, label?, reason?, score?, pool_hint? }` — precomputed (zie job).

## Koios-advies — achtergrond-job
- Bepaalt periodiek/op events (nieuwe kandidaat, statuswijziging, X dagen geen contact, nieuwe match) het `koios_advice` per kandidaat en **slaat het op** (de tabel rendert het direct, niet live per rij).
- Koios-**suggesties** = pivot-rijen `source='koios', status='suggested'` → recruiter accepteert → `active`. (De frontend toont die met een ✨-markering.)

---

## 🐛 last_contact (los bugje — meenemen)
- De **lijst-resource** mist `last_contact_type`. **Voeg `last_contact_type` (plat) toe aan `CandidateListResource`** (naast `last_contact_at`), zodat het contacttype meteen zichtbaar is zonder detail-fetch. (De frontend leest `last_contact_type` al; detail mag het genest blijven sturen.)
- Zorg dat de **seeder `last_contact_type` vult** (bv. `whatsapp|email|phone|rc`) — nu waarschijnlijk null.

---

## Testdata (seeder uitbreiden)
- Een paar **pools** met `context='recruitment'` (naam + kleur).
- `candidate_pool`-rijen: mix van `source='manual'` en `source='koios', status='suggested'`.
- `koios_advice` op een deel van de kandidaten (verschillende `action`-waarden).
- `last_contact_type` gevuld.

Zo zijn de kolommen (TalentPool + Koios), de drawer-chips, de bulk-acties en het instellingenscherm tegen echte data te testen.
