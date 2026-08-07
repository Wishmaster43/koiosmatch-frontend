// planning module — the per-entity Diensten/Planning module (fetch + filter inline,
// plus create/update). Replaces shifts_fetch + shift_fetcher; "Diensten Plakken"
// (shifts_input) stays as a separate manual-input module under the same tab.
import { CalendarDays } from 'lucide-react'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'planning',
  label:    'Diensten',
  category: 'Planning',
  // Native planning node — gated on the 'plan' billing module (picker hides it when off).
  module:   'plan',
  Icon:     CalendarDays,
  color:    'var(--module-teal-strong)',
  bg:       'color-mix(in srgb, var(--module-teal-strong) 10%, transparent)',
  filterFields: [
    { value: 'status',     label: 'Status' },
    { value: 'client',     label: 'Klant' },
    { value: 'location',   label: 'Locatie' },
    { value: 'department', label: 'Afdeling' },
    { value: 'function',   label: 'Functie' },
    { value: 'date',       label: 'Datum' },
  ],
  sortOptions: [
    { value: 'date',   label: 'Datum' },
    { value: 'status', label: 'Status' },
  ],
})
