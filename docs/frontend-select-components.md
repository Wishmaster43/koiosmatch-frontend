# Select-componenten — welke gebruik je? (DUP-2)

> **Regel: bouw nooit een vijfde select.** Er zijn vier gedeelde select-componenten,
> elk voor één duidelijk geval. Pak de juiste of **breid** 'm uit — kopieer nooit een
> dropdown-met-zoek-en-vinkjes opnieuw in een component. Opgesteld 2026-06-24 (architect).

## Beslis-tabel

| Je hebt nodig… | Gebruik | Waar | Kernprops |
|---|---|---|---|
| **Eén waarde**, kies uit een vaste lijst, **native & simpel** (in formulieren / `EditableFieldTable`) | **`SelectField`** | `components/forms/fields.jsx` | `value · onChange · options · placeholder · style` |
| **Eén waarde**, header/meta-picker (status · owner · type), checklist-dropdown, optioneel avatar | **`SelectMenu`** | `components/ui/SelectMenu.jsx` | `value · onChange · options · placeholder · leading · menuWidth` (option mag `initials` dragen → Avatar) |
| **Eén waarde**, **zoekbaar** én je mag een **nieuwe waarde toevoegen** (combobox) | **`CreatableSelect`** | `components/ui/CreatableSelect.jsx` | `value · onChange · options · allowCreate` (`false` = strikt, geen toevoegen) · `menuWidth · style` — slaat één string op |
| **Meerdere waarden**, zoekbare checklist vanuit een **"+ toevoegen"-trigger** (tags · links · branches · pools) | **`SearchSelect`** | `components/ui/SearchSelect.jsx` | `triggerLabel · options · selected[] · onToggle · searchable · width · onSearch` (server-side zoeken) |

## Snelle keuze

- **Single vs multi?** Multi → `SearchSelect`. Single → een van de andere drie.
- **Mag de gebruiker een waarde aanmaken?** Ja → `CreatableSelect` (`allowCreate`). Nee, maar wél zoeken → `CreatableSelect allowCreate={false}`.
- **Header/meta-picker met avatars (owner/recruiter)?** → `SelectMenu`.
- **Gewoon een veld in een formulier/`EditableFieldTable`?** → `SelectField`.

## Wat hoort hier NIET bij

- **Filter-groepen in het rechter paneel** (`RightPanelContext`, `type: 'search-select'`) zijn
  géén importeerbare component maar een **config-shape** die het paneel zelf rendert — gebruik die
  voor pagina-filters, niet een van de bovenstaande.
- **Lookups vullen de `options`**, nooit hardcoded lijsten (CLAUDE.md §3A/§3B): wire `options` aan
  een `useX()`-hook / `LookupsContext` (genders, functies, statussen, pools, …).

## Niet-duplicaten (re-scan 2026-06-24)

Wat eruitziet als "nóg een select" maar het **niet** is — niet consolideren:
`SettingsControls`/`UsersPage` = **kleur-pickers** · `KoiosSteps`/`MatchScoreBlock` = **uitklap-toggles** ·
`EntityHeader`/`KoiosModelPicker` = **custom meta-pickers** (avatar-/model-rendering).
