// scenario module — keep only candidates whose conversation matches the
// configured conditions (AND); attaches the conversation for later steps.
import { GitBranch } from 'lucide-react'

export default {
  type:  'scenario',
  module: 'whatsapp',
  category: 'Communicatie',
  label: 'Scenario / Situatie',
  Icon:  GitBranch,
  color: 'var(--module-green)',
  bg:    'color-mix(in srgb, var(--module-green) 12%, transparent)',
  schema: [
    { key: 'conditions', label: 'Condities', type: 'filters' },
  ],
}
