// error_break module — error handler: stop the route and let the run fail when an error occurs.
import { OctagonX } from 'lucide-react'

export default {
  type:     'error_break',
  category: 'Flow beheer',
  label:    'Stoppen (Break)',
  Icon:     OctagonX,
  // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
  color:    'var(--color-danger)',
  bg:       'var(--color-danger-bg)',
  schema: [
    { key: 'store_incomplete', label: 'Sla incomplete uitvoering op', type: 'boolean', help: 'Vereist dat "onvolledige uitvoeringen opslaan" is ingeschakeld in de workflow instellingen.' },
  ],
}
