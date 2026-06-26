// customers module — the per-entity Klanten module (native, fetch + filter inline,
// plus create/update). The external SM/HF "Klanten" modules stay under their own tabs.
import { Building2 } from 'lucide-react'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'customers',
  label:    'Klanten',
  category: 'Klanten',
  Icon:     Building2,
  color:    '#475569',
  bg:       '#EEF1F5',
  filterFields: [
    { value: 'status',   label: 'Status' },
    { value: 'industry', label: 'Branche' },
    { value: 'owner',    label: 'Eigenaar' },
    { value: 'city',     label: 'Plaats' },
  ],
  sortOptions: [
    { value: 'name',       label: 'Naam' },
    { value: 'created_at', label: 'Aangemaakt' },
  ],
})
