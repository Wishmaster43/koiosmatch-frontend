# Prompt voor Backend Claude — Kandidaat sub-entiteiten CRUD + alles instelbaar

## Context
De frontend (koiosmatch-frontend, `main`) maakt de **hele kandidaat-drawer bewerkbaar** (in-place potlood → diskette/✕): profielvelden, profieltekst, talen, ervaring, opleiding, certificeringen, vaardigheden en matches. Nu werkt bewerken nog **lokaal** — er zijn API-endpoints nodig om het te persisteren. Daarnaast moet **alles instelbaar** worden in Instellingen (lookups). Bouw de API-kant. Werk alleen aan deze feature.

---

## 1. Kandidaat sub-entiteiten — CRUD per kandidaat
Voor elk van deze relaties endpoints (tenant-scoped, `permission:candidates.update`):

```
POST   /candidates/{id}/experiences          PATCH /…/experiences/{eid}     DELETE /…/experiences/{eid}
POST   /candidates/{id}/educations           PATCH /…/educations/{eid}      DELETE /…/educations/{eid}
POST   /candidates/{id}/certifications        PATCH …                        DELETE …
POST   /candidates/{id}/skills                PATCH …                        DELETE …
POST   /candidates/{id}/languages             PATCH …                        DELETE …
POST   /candidates/{id}/placements            PATCH …                        DELETE …
```
(Of: `PUT /candidates/{id}` dat de **volledige arrays** vervangt — de frontend stuurt nu al `languages: [...]` mee in de PATCH-body; mag ook per-relatie. Kies wat past, maar documenteer het.)

### Veld-shapes (camel ⇄ snake — frontend stuurt camel)
- **experience**: `title, company, location, start, end, current (bool), desc`
  → `current=true` betekent "werkt hier nog" → geen einddatum, toon "heden".
- **education**: `title (diploma), school, start, end, in_progress (bool), desc, issued`
  → `in_progress=true` → `end` is de **verwachte** einddatum.
- **certification**: `name, org, issued, expires, license, desc`
- **skill**: `name, level`
- **language**: `language, spoken, written`  (gesproken/schriftelijk niveau)
- **placement (match)**: `client, function, scale, step, hourlyRate, hoursPerWeek, startDate, endDate, contractType, contractDuration`

> **Nieuw t.o.v. nu:** kolommen `experiences.current` (bool) en `educations.in_progress` (bool) toevoegen (migratie).

Detail- + list-resources moeten deze relaties teruggeven (bestaat grotendeels al).

---

## 2. Alles instelbaar in Instellingen (lookups)
Naast de bestaande lookups (candidate_types / funnel_types / statuses — al klaar) en pools, **deze nieuw** (zelfde patroon: `GET` lijst + `POST/PUT/DELETE/reorder`, met `name`/`label` + evt. `color`):

- **`GET /languages`** + CRUD — talenlijst (Settings → Talen). Default-set: Nederlands, Engels, Duits, Frans, Spaans, Pools, Turks, Arabisch, Papiaments, Portugees, Italiaans, Roemeens, Oekraïens.
- **`GET /language-levels`** + CRUD — niveaus. Default: Slecht, Matig, Goed, Zeer goed, Moedertaal.
- **Geslacht als gekleurde lookup** `GET /genders` + CRUD — `{ value, label, color }`. Default: `male` (Man), `female` (Vrouw), `other` (Anders). **Met kleur**, want de frontend gebruikt de geslacht-kleur voor het **kandidaat-avatar/icoon** in de tabel + drawer.

> De frontend leest deze al met fallback-defaults (`useLanguageLookups`); zodra de endpoints leven, komen ze uit de API.

---

## 3. Avatar-/icoonkleuren instelbaar
- **Kandidaat-icoon** in de tabel/drawer: kleur op basis van **geslacht** (zie de `genders`-lookup met `color` hierboven). Lever `gender` als slug mee in de candidate-resources (doet 'ie al).
- **Eigenaar-icoon** (recruiter): maak een **kleur per gebruiker** instelbaar — voeg `avatar_color` toe aan de user/`GET /users`-resource (en een veld in gebruikersbeheer om het te zetten). De frontend kleurt het eigenaar-avatar daarmee.

---

## 4. Zachte kleuren (los, al beschreven)
Zie `docs/backend-prompt-soft-colors.md` — incl. een **recolor-migratie** om bestaande lookup-rijen zonder reseed om te kleuren naar het zachte palet. De **kleurkiezer in de frontend is nu beperkt tot dat zachte palet** (geen vrije hex meer), dus alle nieuwe keuzes zijn al rustig.

---

## Samengevat
1. Migraties: `experiences.current`, `educations.in_progress`, `users.avatar_color`, + `genders`/`languages`/`language_levels` lookup-tabellen.
2. CRUD-endpoints voor de 6 kandidaat-sub-entiteiten.
3. Lookup-endpoints voor talen, niveaus, geslacht (met kleur).
4. `avatar_color` op users + in gebruikersbeheer.
5. Seeder: vul de nieuwe lookups + wat sub-entiteit-data.
