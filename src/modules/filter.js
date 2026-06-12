import { Filter } from 'lucide-react'

export default {
  type:  'filter',
  label: 'Filter',
  Icon:  Filter,
  color: '#7C3AED',
  bg:    '#F5F3FF',
  schema: [
    { key: 'field',    label: 'Veld',     type: 'text',   placeholder: 'status' },
    { key: 'operator', label: 'Operator', type: 'select', options: ['gelijk aan','niet gelijk aan','groter dan','kleiner dan','bevat'] },
    { key: 'value',    label: 'Waarde',   type: 'text',   placeholder: 'actief' },
  ],
}
