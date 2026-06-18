// router module — branch the flow into multiple parallel routes.
import { GitBranch } from 'lucide-react'

export default {
  type:  'router',
  category: 'Flow beheer',
  label: 'Router',
  Icon:  GitBranch,
  color: '#B45309',
  bg:    'var(--color-warning-bg)',
  schema: [
    {
      key:   'routes',
      label: 'Routes',
      type:  'routes',
      help:  'Elke route heeft een naam, filterconditie en eigen vervolgstappen.',
    },
  ],
}
