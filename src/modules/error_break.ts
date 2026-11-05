// error_break module — error handler: stop the route and let the run fail when an error occurs.
import { OctagonX } from 'lucide-react'

export default {
  type:     'error_break',
  category: 'flow',
  label:    'Stop (Break)',
  Icon:     OctagonX,
  // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
  color:    'var(--color-danger)',
  bg:       'var(--color-danger-bg)',
  schema: [
    { key: 'store_incomplete', label: 'Store incomplete run', type: 'boolean', help: 'Requires "store incomplete runs" to be enabled in the workflow settings.' },
  ],
}
