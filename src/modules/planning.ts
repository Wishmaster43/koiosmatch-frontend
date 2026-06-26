// planning module — the per-entity Diensten/Planning module (fetch + filter inline,
// plus create/update). Replaces shifts_fetch + shift_fetcher; "Diensten Plakken"
// (shifts_input) stays as a separate manual-input module under the same tab.
import { CalendarDays } from 'lucide-react'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'planning',
  label:    'Diensten',
  category: 'Planning',
  Icon:     CalendarDays,
  color:    '#0F6E56',
  bg:       '#E1F5EE',
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
