// appointments module — the per-entity Afspraken start module (fetch-only,
// VERTREKMODULE-1: every workflow must start with a Koios master data node or
// webhook, never an action). Mirrors the applications entity module pattern with
// filters on candidate / status / type / owner and sort on scheduled_at / created_at.
import { CalendarDays } from 'lucide-react'
import { tintBg } from '@/lib/tint'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'appointments',
  label:    'Afspraken',
  category: 'Planning',
  Icon:     CalendarDays,
  color:    'var(--module-teal-strong)',
  bg:       tintBg('var(--module-teal-strong)'),
  actions:  ['Ophalen'],
  filterFields: [
    { value: 'candidate', label: 'Kandidaat' },
    { value: 'status',    label: 'Status' },
    { value: 'type',      label: 'Type' },
    { value: 'owner',     label: 'Eigenaar' },
  ],
  sortOptions: [
    { value: 'scheduled_at', label: 'Geplande datum/tijd' },
    { value: 'created_at',   label: 'Aangemaakt' },
  ],
})
