// advanced_parser module — parse text into structured fields using advanced/custom rules.
import { Regex } from 'lucide-react'

export default {
  type:     'advanced_parser',
  category: 'text',
  label:    'Advanced parser',
  Icon:     Regex,
  color:    'var(--color-violet)',
  bg:       'var(--color-violet-bg)',
  schema: [
    { key: 'text', label: 'Text', type: 'textarea', placeholder: '{{1.inhoud}}' },
    { key: 'pattern', label: 'Pattern (regex)', type: 'text', placeholder: '(?P<naam>\\w+)' },
    { key: 'global', label: 'All matches', type: 'boolean' },
    { key: 'case_insensitive', label: 'Case-insensitive', type: 'boolean' },
    { key: 'multiline', label: 'Multiple lines', type: 'boolean' },
  ],
}
