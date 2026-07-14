// html_parser module — extract elements/values from an HTML document.
import { FileCode2 } from 'lucide-react'

export default {
  type:     'html_parser',
  category: 'Tekst & Parsing',
  label:    'HTML Verwerker',
  Icon:     FileCode2,
  color:    'var(--color-violet)',
  bg:       'var(--color-violet-bg)',
  schema: [
    { key: 'html', label: 'HTML-inhoud', type: 'textarea', placeholder: '<html>...</html>' },
    { key: 'selector', label: 'CSS-selector', type: 'text', placeholder: '.mijn-element of #id', help: 'Selecteer een specifiek element uit de HTML.' },
    { key: 'continue_even_when_empty', label: 'Doorgaan als leeg', type: 'boolean' },
  ],
}
