import { GitBranch } from 'lucide-react'

export default {
  type:  'router',
  label: 'Router',
  Icon:  GitBranch,
  color: '#B45309',
  bg:    '#FEF3C7',
  schema: [
    {
      key:   'routes',
      label: 'Routes',
      type:  'routes',
      help:  'Elke route heeft een naam, filterconditie en eigen vervolgstappen.',
    },
  ],
}
