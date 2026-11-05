// customers module — the per-entity Klanten module (native, fetch + filter inline,
// plus create/update). The external SM/HF "Klanten" modules stay under their own tabs.
import { Building2 } from 'lucide-react'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'customers',
  label:    'Customers',
  category: 'customers',
  Icon:     Building2,
  color:    'var(--module-slate)',
  bg:       'color-mix(in srgb, var(--module-slate) 8%, transparent)',
  filterFields: [
    { value: 'status',   label: 'Status' },
    { value: 'industry', label: 'Industry' },
    { value: 'owner',    label: 'Owner' },
    { value: 'city',     label: 'City' },
  ],
  sortOptions: [
    { value: 'name',       label: 'Name' },
    { value: 'created_at', label: 'Created' },
  ],
})
