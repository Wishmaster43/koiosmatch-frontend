// table_aggregator module — aggregate bundles into a table structure.
import { Table2 } from 'lucide-react'

export default {
  type:     'table_aggregator',
  category: 'Flow beheer',
  label:    'Tabel samenvoegen',
  Icon:     Table2,
  color:    '#0369A1',
  bg:       'var(--color-info-bg)',
  schema: [
    { key: 'source_module', label: 'Bronmodule', type: 'text', placeholder: 'automatisch ingevuld' },
    { key: 'columns', label: 'Kolommen (kommagescheiden)', type: 'text', placeholder: 'naam, email, telefoon' },
    { key: 'column_separator', label: 'Kolomscheidingsteken', type: 'select', options: ['Tab', 'Komma', 'Puntkomma'] },
    { key: 'row_separator', label: 'Rijscheidingsteken', type: 'select', options: ['Nieuwe regel', 'Puntkomma'] },
  ],
}
