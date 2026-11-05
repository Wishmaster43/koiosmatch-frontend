// table_aggregator module — aggregate bundles into a table structure.
import { Table2 } from 'lucide-react'

export default {
  type:     'table_aggregator',
  category: 'flow',
  label:    'Table aggregator',
  Icon:     Table2,
  color:    'var(--module-info)',
  bg:       'var(--color-info-bg)',
  schema: [
    { key: 'source_module', label: 'Source module', type: 'text', placeholder: 'filled automatically' },
    { key: 'columns', label: 'Columns (comma-separated)', type: 'text', placeholder: 'name, email, phone' },
    { key: 'column_separator', label: 'Column separator', type: 'select', options: ['Tab', 'Komma', 'Puntkomma'] },
    { key: 'row_separator', label: 'Row separator', type: 'select', options: ['Nieuwe regel', 'Puntkomma'] },
  ],
}
