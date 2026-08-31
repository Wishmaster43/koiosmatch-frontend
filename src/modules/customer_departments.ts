// customer_departments module — vertrekmodule (ENTITY-MODULES-ONTBREKEND-1, Danny's §10
// subjectlijst; CMBE-vocab definitief 31-08). Fetch-only: the engine's thin
// module carries Ophalen only, so no create/update actions here (§3 — no fake
// affordances). Subject-id: customer_department_id (hidden from_trigger, engine-side).
import { Network } from 'lucide-react'
import { tint } from '@/lib/tint'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'customer_departments',
  label:    'Afdelingen',
  category: 'Klanten',
  Icon:     Network,
  color:    'var(--module-warmgrey)',
  bg:       tint('var(--module-warmgrey)', 16),
  actions:  ['Ophalen'],
  filterFields: [
    { value: 'customer', label: 'Klant' },
    { value: 'location', label: 'Vestiging' },
    { value: 'status', label: 'Status' },
  ],
  sortOptions: [
    { value: 'name', label: 'Naam' },
    { value: 'created_at', label: 'Aangemaakt' },
  ],
})
