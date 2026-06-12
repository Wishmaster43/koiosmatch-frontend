import { Calculator } from 'lucide-react'

export default {
  type:     'numeric_aggregator',
  category: 'Flow beheer',
  label:    'Numeriek samenvoegen',
  Icon:     Calculator,
  color:    '#0369A1',
  bg:       '#E0F2FE',
  schema: [
    { key: 'source_module', label: 'Bronmodule', type: 'text', placeholder: 'automatisch ingevuld' },
    { key: 'aggregate_function', label: 'Functie', type: 'select', options: ['SUM', 'COUNT', 'AVG', 'MAX', 'MIN'] },
    { key: 'value', label: 'Waarde', type: 'text', placeholder: '{{1.bedrag}}' },
    { key: 'group_by', label: 'Groeperen op', type: 'text', placeholder: 'leeg = één groep' },
  ],
}
