// get_variables module — read multiple stored workflow variables at once.
import { BookMarked } from 'lucide-react'

export default {
  type:     'get_variables',
  category: 'flow',
  label:    'Get variables',
  Icon:     BookMarked,
  color:    'var(--module-info)',
  bg:       'var(--color-info-bg)',
  schema: [
    { key: 'variable_names', label: 'Variable names', type: 'textarea', placeholder: 'name_1\nname_2', help: 'One name per line.' },
  ],
}
