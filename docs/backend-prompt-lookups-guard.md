# Backend-prompt — Lookups: vacancy-endpoints fixen, "in gebruik"-vlag, demo-data

De frontend (Instellingen → lookups) is klaar en verwacht nu drie dingen van de
backend. Alles gaat via de bestaande lookup-resources (label/value/color/sort_order).

---

## 1. Vacancy-endpoints geven 404/500 — fixen

De Vacature-instellingen kunnen geen status/fase/veld toevoegen. Console:

```
GET    /api/vacancy-phases          → 500
GET    /api/vacancy-custom-fields   → 404
PUT    /api/vacancy-statuses/reorder→ 404
GET    /api/vacancy-statuses        → 500
```

Nodig (zelfde patroon als de andere lookups — GET lijst + POST + PUT + DELETE + PUT `/reorder`):

- **`/vacancy-statuses`** — `GET/POST/PUT/DELETE` + `PUT /vacancy-statuses/reorder` ; velden `label`/`name`, `color`, `sort_order`. (500 = controller/migratie ontbreekt of kolom `color` mist.)
- **`/vacancy-phases`** — idem (`GET/POST/PUT/DELETE` + `/reorder`). (500.)
- **`/vacancy-custom-fields`** — `GET/POST/DELETE` ; veld `name`. (404 = route bestaat niet.)

> De frontend stuurt bij aanmaken zowel `name` als `label` mee, dus accepteer één van beide.

---

## 2. "In gebruik"-vlag op élke lookup-resource (zodat verwijderen veilig is)

De gebruiker mag een lookup **niet kunnen verwijderen zolang die nog ergens aan
hangt** (bv. een geslacht/status/pool die door kandidaten gebruikt wordt). De
frontend zet de prullenbak automatisch uit zodra een item dit meekrijgt:

Voeg aan **elke lookup-resource** (in de GET-lijst) één van deze velden toe:

```json
{ "id": 3, "label": "Vrouw", "color": "#E06C9F", "in_use": true }
```

- Bij voorkeur **`in_use`** (bool). `usage_count` (int) of `is_used`/`locked` mag ook —
  de frontend leest `in_use ?? is_used ?? locked ?? usage_count > 0`.
- Geldt voor: **genders, languages, language-levels, pools, candidate-lookups
  (types/funnel/statuses), candidate-rejection-reasons, vacancy-statuses,
  vacancy-phases, vacancy-custom-fields**.

**Vangnet (verplicht):** laat `DELETE` op een in-gebruik-item **HTTP 409** geven
(niet 500). De frontend vangt 409 op, laat de rij staan en markeert 'm als in gebruik.

> "In gebruik" = er bestaat minstens één record dat naar deze lookup verwijst
> (kandidaat, vacature, plaatsing, …). Een simpele `exists()`-check per relatie volstaat.

---

## 3. Demo-data (seeder) voor de demo

Zet wat realistische dummy's neer zodat de demo niet leeg is:

- **Talentenpools (`/pools`)** — bv. *Flexpool Zorg*, *Spoed/ad-hoc*, *Alumni*,
  *Inzetpool Planning* (deze laatste met `context: 'planning'`, de rest
  `context: 'recruitment'`), elk met een zachte kleur.
- **Vacancy-statuses** — bv. *Concept, Open, On hold, Vervuld, Gesloten*.
- **Vacancy-phases** — bv. *Intake, Werving, Voordracht, Plaatsing*.

Allemaal met `sort_order` en een kleur uit het zachte palet (zoals de recolor-migratie).
Markeer een paar als `in_use` (gekoppeld aan bestaande kandidaten/vacatures) zodat de
verwijder-beveiliging in de demo zichtbaar is.

---

## Acceptatie

1. Vacature → status/fase/veld toevoegen werkt (geen 404/500), reorder werkt.
2. Elke lookup-GET bevat `in_use` (of equivalent); een in-gebruik-item toont een
   grijze, uitgeschakelde prullenbak; `DELETE` erop geeft 409, niet 500.
3. Pools/vacancy-statuses/-phases hebben demo-rijen met kleur + `sort_order`.
