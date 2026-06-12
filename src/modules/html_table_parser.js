import { TableProperties } from 'lucide-react'

export default {
  type:     'html_table_parser',
  category: 'Tekst & Parsing',
  label:    'HTML-tabel verwerker',
  Icon:     TableProperties,
  color:    '#7C3AED',
  bg:       '#EDE9FE',
  schema: [
    { key: 'html', label: 'HTML-inhoud', type: 'textarea', placeholder: '<table>...</table>' },
    { key: 'row_selector', label: 'Rij-selector (optioneel)', type: 'text', placeholder: 'tr' },
  ],
}
