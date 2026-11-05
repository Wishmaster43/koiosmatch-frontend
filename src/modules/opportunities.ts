// opportunities module — the per-entity Kansen module (fetch + filter inline, plus
// create/update).
import { Target } from 'lucide-react'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'opportunities',
  label:    'Opportunities',
  category: 'opportunities',
  Icon:     Target,
  // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
  color:    'var(--color-warning)',
  // Own tint % — kept distinct from --color-warning-bg (shared by router/shifts_input) so the Kansen entity stays visually distinguishable.
  bg:       'color-mix(in srgb, var(--color-warning) 9%, transparent)',
  filterFields: [
    { value: 'status',   label: 'Status' },
    { value: 'customer', label: 'Customer' },
    { value: 'owner',    label: 'Owner' },
    { value: 'value',    label: 'Value' },
  ],
  sortOptions: [
    { value: 'created_at', label: 'Date' },
    { value: 'value',      label: 'Value' },
    { value: 'status',     label: 'Status' },
  ],
})
