// filter module — only let bundles pass that satisfy a condition.
import { Filter } from 'lucide-react'

export default {
  type:  'filter',
  category: 'Flow beheer',
  label: 'Filter',
  Icon:  Filter,
  color: 'var(--color-violet)',
  // eslint-disable-next-line no-restricted-syntax -- deliberately lighter than --color-violet-bg to visually separate "Flow beheer" nodes from the parser family
  bg:    '#F5F3FF',
  schema: [
    { key: 'field',    label: 'Veld',     type: 'text',   placeholder: 'status' },
    { key: 'operator', label: 'Operator', type: 'select', options: ['gelijk aan','niet gelijk aan','groter dan','kleiner dan','bevat'] },
    { key: 'value',    label: 'Waarde',   type: 'text',   placeholder: 'actief' },
  ],
}
