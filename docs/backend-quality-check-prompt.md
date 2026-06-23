# Prompt voor backend-Claude — codekwaliteit-discipline in de docs + compliance-check

> Plak dit in de `koiosmatch-api`-repo. Het is een **doc- + compliance-check**, geen feature-werk.
> Rapporteer met cijfers, niet met onderbuik. Claim NOOIT "alles klopt" zonder bewijs
> (static analysis + tests groen + size-scan). Spiegelt de frontend-discipline (CLAUDE.md §3).

## Deel A — Staat het in de docs? (backend-CLAUDE.md)
Controleer of backend-CLAUDE.md deze drie dingen expliciet documenteert. Zo niet → voeg toe.

1. **Size-discipline (gedeelde standaard, = frontend CLAUDE.md §3):**
   - Streef ≤ ~250 r/klasse · **250–400 = oordeel** (cohesief single-purpose mag) ·
     **> ~400 = splitsen, ook als het werkt** · **1000 = absolute harde cap (nooit naderen)**.
   - Regel: **single-purpose, niet line-count.** Een bestand iets over z'n target is geen
     overtreding; een god-class wel.
   - Per-laag richtwaarden: controller ≤ ~150 (thin: receive → delegate → Resource, geen
     logica/queries) · Service/Action ~200–300, één publieke methode · Model/Resource/FormRequest
     ≤ ~200 · methode ≤ ~30–40 r. Migraties uitgezonderd van de regel-cap.
2. **Project-brede verificatie-gewoonte** (draai dit na ELKE wijziging, het Laravel-equivalent
   van build+lint+test):
   - **Pint** (of PHP-CS-Fixer) — format/lint.
   - **PHPStan / Larastan** (hoog level) — static analysis = de "klopt/compileert"-vangrail
     (PHP heeft geen build, dít is je net).
   - **Pest / PHPUnit** — tests op kritieke paden.
3. **Migratie-conventie:** NOOIT `add_*` / `alter_*` / `change_*`-migraties — vouw elke
   schemawijziging in de bestaande `create_<table>`-migratie (nieuw migratiebestand = alleen
   nieuwe tabel). Toepassen via `migrate:fresh` / `php artisan dev:reset` (pre-release).

## Deel B — Voldoet de backend er ook aan? (meten)
Draai en rapporteer de cijfers:

1. **Size-scan** — bestanden boven de drempels:
   `find app -name '*.php' | xargs wc -l | sort -rn | head -30`
   - 0 boven 1000 (harde cap)? · welke > 400 (moeten gesplitst)? · welke god-models /
     fat controllers (logica/queries in de controller i.p.v. Service/Action)?
2. **Pint:**       `vendor/bin/pint --test`
3. **Static:**     `vendor/bin/phpstan analyse`    (Larastan, zo hoog mogelijk level)
4. **Tests:**      `php artisan test`  (of: `vendor/bin/pest`)
5. **Migraties:**  staan er `add_*`/`alter_*`/`change_*`-migratiebestanden die in de
   `create_<table>` gevouwen hadden moeten worden?

## Deel C — Rapporteer (scorecard)
- **Docs:** staan A1/A2/A3 in backend-CLAUDE.md? (ja/nee per punt; toegevoegd zo niet)
- **Compliance:** Pint ✅/❌ · PHPStan ✅/❌ (#errors) · Tests ✅/❌ (#passed/#total) ·
  Size: # bestanden > 400, # > 1000, god-classes · Migratie-conventie ✅/❌.
- **Backlog:** concrete lijst van wat niet voldoet + per item de fix (welke klasse splitsen,
  welke logica naar een Service/Action, welke migratie vouwen).
- **Eerlijk verdict:** "static groen + tests groen" ≠ "alles klopt" — benoem wat nog ongedekt
  is (lage testdekking, ongeverifieerd gedrag).
