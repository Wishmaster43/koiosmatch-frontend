// router module — branch the flow into multiple parallel routes.
import { GitBranch } from 'lucide-react'

export default {
  type:  'router',
  category: 'Flow beheer',
  label: 'Router',
  Icon:  GitBranch,
  color: '#B45309',
  bg:    'var(--color-warning-bg)',
  // No form fields — branches are configured via canvas edges.
  // Draw a connection from this node to each next module and set a filter on the edge.
  schema: [],
}
