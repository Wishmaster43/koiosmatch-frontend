# Prompt voor Backend Claude — zachte lookup-kleuren in de seeders

## Context
De frontend gebruikt nu een **zacht, rustig kleurpalet** (gedempte mid-tonen die werken in light én dark modus). Maar de kleuren die de app toont komen uit de **API/DB** (de tenant-keuze is de bron van waarheid) — niet uit frontend-defaults. De demo-tenant heeft nog de oude, fellere geseede kleuren.

**Taak:** trek de **seeder-kleuren** gelijk met het zachte palet hieronder, zodat na een `migrate:fresh` + `candidates:seed-demo` de API overal zachte kleuren teruggeeft. **Alleen hex-waarden wijzigen** — geen slugs, labels of structuur aanpassen.

## Bestanden
- `database/seeders/CandidateLookupSeeder.php` — statussen, funnel-types, candidate-types
- `database/seeders/Concerns/SeedsCandidates.php` — o.a. de demo-pools (en evt. lookup-kleuren)

## Exacte kleuren per slug (overnemen)

**candidate_types**
| slug | color |
|---|---|
| on_call | `#6E8FD6` |
| freelance | `#5FB0AC` |
| payroll | `#A98AD1` |
| temp_agency | `#DDA071` |
| secondment | `#6FA8C4` |
| on_demand | `#C98BBA` |

**funnel_types**
| slug | color |
|---|---|
| prospect | `#94A3B8` |
| intake | `#8C86D9` |
| pool | `#79B58E` |
| alumni | `#6FA8C4` |

**statuses**
| slug | color |
|---|---|
| prospect | `#94A3B8` |
| intake | `#8C86D9` |
| active | `#79B58E` |
| inactive | `#C9AC64` |
| sick | `#D98A8A` |
| leave | `#6FA8C4` |
| external | `#DDA071` |
| blocked | `#B96B6B` |
| outflow | `#8A94A6` |
| deleted | `#64748B` |

**pools** (de paar demo-pools) — kies uit het palet, bv.: `#6E8FD6`, `#79B58E`, `#A98AD1`, `#DDA071`.

## Het volledige zachte palet (ter referentie / voor nieuwe waarden)
```
#64748B  #94A3B8  #8A94A6   (neutrale grijzen)
#6E8FD6  #8C86D9  #A98AD1   (blauw → paars)
#C98BBA  #D98A8A  #B96B6B   (roze → rood)
#DDA071  #C9AC64             (oranje → goud)
#79B58E  #5FB0AC  #6FA8C4   (groen → teal → sky)
```

## Na afloop
`php artisan migrate:fresh` (+ tenant-migraties) → `php artisan candidates:seed-demo --count=500`. De API geeft dan zachte kleuren; de frontend toont ze meteen.

> Let op: dit verandert alleen de **begin-/seed-kleuren**. Kleuren die een tenant later zelf kiest blijven leidend (API = bron van waarheid).
