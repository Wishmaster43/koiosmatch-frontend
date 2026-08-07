// sleep module — pause execution briefly (e.g. for rate limiting).
import { Timer } from 'lucide-react'

export default {
  type:     'sleep',
  category: 'Flow beheer',
  label:    'Wachten',
  Icon:     Timer,
  color:    'var(--module-neutral)',
  bg:       'color-mix(in srgb, var(--module-neutral) 8%, transparent)',
  schema: [
    { key: 'delay', label: 'Wachttijd (seconden)', type: 'number', placeholder: '5', help: 'Aantal seconden om te wachten voor de volgende module start.' },
  ],
}
