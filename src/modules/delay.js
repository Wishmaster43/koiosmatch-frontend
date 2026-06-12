import { Clock } from 'lucide-react'

export default {
  type:  'delay',
  category: 'Flow beheer',
  label: 'Wachttijd',
  Icon:  Clock,
  color: '#5F5E5A',
  bg:    '#F1EFE8',
  schema: [
    { key: 'hours',         label: 'Wachten (uren)',    type: 'number',  placeholder: '24' },
    { key: 'skip_weekends', label: 'Weekend overslaan', type: 'boolean' },
  ],
}
