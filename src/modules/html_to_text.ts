// html_to_text module — strip HTML markup down to plain text.
import { FileText } from 'lucide-react'

export default {
  type:     'html_to_text',
  category: 'Tekst & Parsing',
  label:    'HTML naar tekst',
  Icon:     FileText,
  color:    'var(--color-violet)',
  bg:       'var(--color-violet-bg)',
  schema: [
    { key: 'html', label: 'HTML-inhoud', type: 'textarea', placeholder: '<p>Tekst hier</p>' },
  ],
}