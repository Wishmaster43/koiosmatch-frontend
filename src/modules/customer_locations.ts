// customer_locations module — vertrekmodule (ENTITY-MODULES-ONTBREKEND-1, Danny's §10
// subjectlijst; CMBE-vocab definitief 31-08). Fetch-only: the engine's thin
// module carries Ophalen only, so no create/update actions here (§3 — no fake
// affordances). Subject-id: customer_location_id (hidden from_trigger, engine-side).
import { MapPin } from 'lucide-react'
import { tint } from '@/lib/tint'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'customer_locations',
  label:    'Locaties',
  category: 'Klanten',
  Icon:     MapPin,
  color:    'var(--module-cyan)',
  bg:       tint('var(--module-cyan)', 16),
  actions:  ['Ophalen'],
  filterFields: [
    { value: 'customer', label: 'Klant' },
    { value: 'city', label: 'Plaats' },
    { value: 'status', label: 'Status' },
  ],
  sortOptions: [
    { value: 'name', label: 'Naam' },
    { value: 'city', label: 'Plaats' },
    { value: 'created_at', label: 'Aangemaakt' },
  ],
})
