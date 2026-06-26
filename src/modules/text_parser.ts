// text_parser module — extract data from text using a pattern/expression.
import { ScanText } from 'lucide-react'

export default {
  type:     'text_parser',
  category: 'Tekst & Parsing',
  label:    'Tekst verwerker',
  Icon:     ScanText,
  color:    '#7C3AED',
  bg:       '#EDE9FE',
  schema: [
    { key: 'text', label: 'Tekst', type: 'textarea', placeholder: '{{1.inhoud}}' },
    { key: 'pattern', label: 'Patroon (regex)', type: 'text', placeholder: '(\\d+)' },
    { key: 'global', label: 'Alle overeenkomsten', type: 'boolean' },
    { key: 'case_insensitive', label: 'Hoofdletterongevoelig', type: 'boolean' },
  ],
}
