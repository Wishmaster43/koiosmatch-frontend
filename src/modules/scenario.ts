// scenario module — keep only candidates whose conversation matches the
// configured conditions (AND); attaches the conversation for later steps.
import { GitBranch } from 'lucide-react'

export default {
  type:  'scenario',
  module: 'whatsapp',
  category: 'Communicatie',
  label: 'Scenario / Situatie',
  Icon:  GitBranch,
  color: '#3B6D11',
  bg:    '#EAF3DE',
  schema: [
    { key: 'conditions', label: 'Condities', type: 'filters' },
  ],
}
