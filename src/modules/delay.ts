// delay module — pause the workflow for a configured duration before continuing.
import { Clock } from 'lucide-react'

export default {
  type:  'delay',
  category: 'Flow beheer',
  label: 'Wachttijd',
  Icon:  Clock,
  color: 'var(--module-warmgrey)',
  bg:    'color-mix(in srgb, var(--module-warmgrey) 11%, transparent)',
  schema: [
    { key: 'hours',         label: 'Wachten (uren)',    type: 'number',  placeholder: '24' },
    { key: 'skip_weekends', label: 'Weekend overslaan', type: 'boolean' },
  ],
}
