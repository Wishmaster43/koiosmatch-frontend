import { Timer } from 'lucide-react'

export default {
  type:     'sleep',
  category: 'Flow beheer',
  label:    'Wachten',
  Icon:     Timer,
  color:    '#6B7280',
  bg:       '#F3F4F6',
  schema: [
    { key: 'delay', label: 'Wachttijd (seconden)', type: 'number', placeholder: '5', help: 'Aantal seconden om te wachten voor de volgende module start.' },
  ],
}
