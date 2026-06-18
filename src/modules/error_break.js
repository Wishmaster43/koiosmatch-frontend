// error_break module — error handler: stop the route and let the run fail when an error occurs.
import { OctagonX } from 'lucide-react'

export default {
  type:     'error_break',
  category: 'Foutafhandeling',
  label:    'Stoppen (Break)',
  Icon:     OctagonX,
  color:    'var(--color-danger)',
  bg:       '#FEF2F2',
  schema: [
    { key: 'store_incomplete', label: 'Sla incomplete uitvoering op', type: 'boolean', help: 'Vereist dat "onvolledige uitvoeringen opslaan" is ingeschakeld in de workflow instellingen.' },
  ],
}
