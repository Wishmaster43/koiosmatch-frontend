import { OctagonX } from 'lucide-react'

export default {
  type:     'error_break',
  category: 'Foutafhandeling',
  label:    'Stoppen (Break)',
  Icon:     OctagonX,
  color:    '#DC2626',
  bg:       '#FEF2F2',
  schema: [
    { key: 'store_incomplete', label: 'Sla incomplete uitvoering op', type: 'boolean', help: 'Vereist dat "onvolledige uitvoeringen opslaan" is ingeschakeld in de workflow instellingen.' },
  ],
}
