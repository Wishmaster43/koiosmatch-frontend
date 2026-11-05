// html_table_parser module — parse an HTML table into structured rows and columns.
import { TableProperties } from 'lucide-react'

export default {
  type:     'html_table_parser',
  category: 'text',
  label:    'HTML table parser',
  Icon:     TableProperties,
  color:    'var(--color-violet)',
  bg:       'var(--color-violet-bg)',
  schema: [
    { key: 'html', label: 'HTML content', type: 'textarea', placeholder: '<table>...</table>' },
    { key: 'row_selector', label: 'Row selector (optional)', type: 'text', placeholder: 'tr' },
  ],
}
