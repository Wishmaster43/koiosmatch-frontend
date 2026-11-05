// text_parser module — extract data from text using a pattern/expression.
import { ScanText } from 'lucide-react'

export default {
  type:     'text_parser',
  category: 'text',
  label:    'Text parser',
  Icon:     ScanText,
  color:    'var(--color-violet)',
  bg:       'var(--color-violet-bg)',
  schema: [
    { key: 'text', label: 'Text', type: 'textarea', placeholder: '{{1.inhoud}}' },
    { key: 'pattern', label: 'Pattern (regex)', type: 'text', placeholder: '(\\d+)' },
    { key: 'global', label: 'All matches', type: 'boolean' },
    { key: 'case_insensitive', label: 'Case-insensitive', type: 'boolean' },
  ],
}
