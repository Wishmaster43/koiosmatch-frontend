// opportunities module — the per-entity Kansen module (fetch + filter inline, plus
// create/update).
import { Target } from 'lucide-react'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'opportunities',
  label:    'Kansen',
  category: 'Kansen',
  Icon:     Target,
  color:    'var(--color-warning)',
  // eslint-disable-next-line no-restricted-syntax -- module-palette tint, kept distinct from --color-warning-bg (shared by router/shifts_input) so the Kansen entity stays visually distinguishable
  bg:       '#FEF1E2',
  filterFields: [
    { value: 'status',   label: 'Status' },
    { value: 'customer', label: 'Klant' },
    { value: 'owner',    label: 'Eigenaar' },
    { value: 'value',    label: 'Waarde' },
  ],
  sortOptions: [
    { value: 'created_at', label: 'Datum' },
    { value: 'value',      label: 'Waarde' },
    { value: 'status',     label: 'Status' },
  ],
})
