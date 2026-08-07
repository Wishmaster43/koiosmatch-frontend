// filter module — only let bundles pass that satisfy a condition.
import { Filter } from 'lucide-react'

export default {
  type:  'filter',
  category: 'Flow beheer',
  label: 'Filter',
  Icon:  Filter,
  color: 'var(--color-violet)',
  // Lighter mix than --color-violet-bg (~14%) so "Flow beheer" nodes visually separate from the parser family.
  bg:    'color-mix(in srgb, var(--color-violet) 6%, transparent)',
  schema: [
    { key: 'field',    label: 'Veld',     type: 'text',   placeholder: 'status' },
    { key: 'operator', label: 'Operator', type: 'select', options: ['gelijk aan','niet gelijk aan','groter dan','kleiner dan','bevat'] },
    { key: 'value',    label: 'Waarde',   type: 'text',   placeholder: 'actief' },
  ],
}
