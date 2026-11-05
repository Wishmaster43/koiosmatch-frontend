// numeric_aggregator module — aggregate numbers (sum/avg/min/max/count) across bundles.
import { Calculator } from 'lucide-react'

export default {
  type:     'numeric_aggregator',
  category: 'flow',
  label:    'Numeric aggregator',
  Icon:     Calculator,
  color:    'var(--module-info)',
  bg:       'var(--color-info-bg)',
  schema: [
    { key: 'source_module', label: 'Source module', type: 'text', placeholder: 'automatisch ingevuld' },
    { key: 'aggregate_function', label: 'Function', type: 'select', options: ['SUM', 'COUNT', 'AVG', 'MAX', 'MIN'] },
    { key: 'value', label: 'Value', type: 'text', placeholder: '{{1.bedrag}}' },
    { key: 'group_by', label: 'Group by', type: 'text', placeholder: 'leeg = één groep' },
  ],
}
