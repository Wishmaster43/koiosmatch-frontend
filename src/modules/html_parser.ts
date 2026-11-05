// html_parser module — extract elements/values from an HTML document.
import { FileCode2 } from 'lucide-react'

export default {
  type:     'html_parser',
  category: 'text',
  label:    'HTML parser',
  Icon:     FileCode2,
  color:    'var(--color-violet)',
  bg:       'var(--color-violet-bg)',
  schema: [
    { key: 'html', label: 'HTML content', type: 'textarea', placeholder: '<html>...</html>' },
    { key: 'selector', label: 'CSS selector', type: 'text', placeholder: '.my-element or #id', help: 'Select a specific element from the HTML.' },
    { key: 'continue_even_when_empty', label: 'Continue when empty', type: 'boolean' },
  ],
}
