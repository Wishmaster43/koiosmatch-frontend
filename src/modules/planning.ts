// planning module — the per-entity Diensten/Planning module (fetch + filter inline,
// plus create/update). Replaces shifts_fetch + shift_fetcher; "Diensten Plakken"
// (shifts_input) stays as a separate manual-input module under the same tab.
import { CalendarDays } from 'lucide-react'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'planning',
  label:    'Shifts',
  category: 'planning',
  // Native planning node — gated on the 'plan' billing module (picker hides it when off).
  module:   'plan',
  Icon:     CalendarDays,
  color:    'var(--module-teal-strong)',
  bg:       'color-mix(in srgb, var(--module-teal-strong) 10%, transparent)',
  filterFields: [
    { value: 'status',     label: 'Status' },
    { value: 'client',     label: 'Customer' },
    { value: 'location',   label: 'Location' },
    { value: 'department', label: 'Department' },
    { value: 'function',   label: 'Function' },
    { value: 'date',       label: 'Date' },
  ],
  sortOptions: [
    { value: 'date',   label: 'Date' },
    { value: 'status', label: 'Status' },
  ],
})
