# Backend-prompt — Kandidaat sub-entiteiten: exacte body-contracten + 2 nieuwe endpoints

De frontend persisteert nu álle kandidaat-sub-lijsten optimistisch via
`POST/PATCH/DELETE /candidates/{id}/{relation}`. Alles faalt soft, dus een
verkeerde of ontbrekende route breekt de UI niet — maar dan slaat het ook niets op.
Hieronder de **exacte velden die de frontend stuurt**. Pas óf de kolomnamen aan,
óf zet ze in de FormRequest/`$fillable` van de backend zodat ze matchen.

> Antwoord-conventie die de frontend verwacht: na `POST` het aangemaakte record
> (incl. `id`) teruggeven als `{ data: {...} }` of plat `{...}`. De frontend
> vervangt z'n tijdelijke negatieve id door de echte server-`id`.

---

## 1. Bestaande relaties — bevestig de kolomnamen

Routes (per kandidaat): `POST /candidates/{id}/{rel}` · `PATCH …/{rel}/{eid}` · `DELETE …/{rel}/{eid}`

**`experiences`** (work experience)
```
function_title, employer, location, start_date, end_date, current (bool), description
```

**`educations`**
```
title, school, start_date, end_date, in_progress (bool), description, issue_date
```

**`certifications`**
```
name, organisation, issue_date, expiry_date, license_number, description
```

**`skills`**
```
name, level
```

**`placements`** (UI-naam: "Matches")
```
client, function_title, scale, step, hourly_rate, hours_per_week,
start_date, end_date, contract_type, contract_duration
```

**`languages`** — wordt als **hele array** meegestuurd in `PATCH /candidates/{id}`
(`{ languages: [{ language, spoken, written }, …] }`). Per-relatie-route mag ook,
maar de array-variant is wat de UI nu doet.

**`preferences`** en **`zzp`** — ook als nested object in `PATCH /candidates/{id}`:
```
preferences: { available_from, hours_per_week, preferred_days, max_travel_km,
  max_travel_min, has_license (bool), own_transport (bool), function_pref,
  sector_pref, min_rate, contract_pref, remarks }
zzp: { company_name, kvk_number, vat_number, kor (bool), intracommunautair (bool),
  street, house_number, postal_code, city, country, creditor_number, business_email,
  invoice_email, iban, self_billing (bool), payment_discount, mediation_costs, payment_term }
```

---

## 2. NIEUW — Documenten (multipart upload)

De frontend uploadt nu echte bestanden. Nodig:

- **`POST /candidates/{id}/documents`** — `multipart/form-data` met velden
  `file` (binary), `type` (string, bv. CV/ID-bewijs/Diploma/…), `name` (string).
  Teruggeven: `{ id, name, type, size, url }` (`url` = downloadbare/inline link).
- **`PATCH /candidates/{id}/documents/{docId}`** — `{ name }` (hernoemen).
- **`DELETE /candidates/{id}/documents/{docId}`**.
- **GET-detail** moet `documents: [{ id, name, type, size, url }]` teruggeven.

> Privacy/AVG: documenten zijn bijzondere persoonsgegevens — niet publiek serveren,
> alleen via geautoriseerde, tenant-gescoped link. Valideer mime/grootte server-side.

---

## 3. NIEUW — Branches (kandidaat ↔ klant/vestiging)

Het "Vestiging"-blok koppelt een kandidaat aan één of meer klanten uit
`GET /crm/customers`. **Frontend wacht op jouw contract** — ik heb dit bewust nog
niet vastgepind omdat ids vs namen onduidelijk is. Kies en documenteer:

- Voorkeur: **`POST /candidates/{id}/branches`** `{ customer_id }` +
  **`DELETE /candidates/{id}/branches/{customerId}`**, en GET-detail levert
  `branches: [{ id, name }]` (id = customer/branch-id, name = weergavenaam).
- Laat me weten welke key (`customer_id` of `branch_id`) en of het een aparte
  pivot is. Dan draai ik het Vestiging-blok in één edit om naar persisteren.

---

## 4. Herinnering — nog open uit vorige prompt (`backend-prompt-lookups-guard.md`)

1. **`in_use`-vlag** op élke lookup-GET (genders/talen/niveaus/pools/kandidaat-
   lookups/afwijsredenen/vacancy-status&fasen/custom-fields) + `DELETE` → **409**
   bij in-gebruik. Zonder dit blijft de prullenbak overal klikbaar.
2. **Demo-data**: dummy talentenpools + vacancy-statussen/-fasen met kleur.
3. Vacancy-routes gaven eerder 404/500 → nu **401** (bestaan), dus dat lijkt klaar;
   graag bevestigen dat toevoegen/reorder echt werkt met een ingelogde sessie.

---

## Acceptatie

- Ervaring/Opleiding/Cert/Skill/Match toevoegen+wijzigen+verwijderen persisteert
  (refresh = blijft staan), met de velden uit §1.
- Document uploaden/hernoemen/verwijderen werkt (§2); detail toont `url`.
- Branches-contract gekozen + teruggekoppeld (§3).
- `in_use` + demo-data live (§4).
