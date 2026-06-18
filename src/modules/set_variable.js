// set_variable module — store a single variable for use in later steps.
import { StickyNote } from 'lucide-react'

export default {
  type:     'set_variable',
  category: 'Flow beheer',
  label:    'Variabele instellen',
  Icon:     StickyNote,
  color:    'var(--color-warning)',
  bg:       'var(--color-warning-bg)',
  schema: [
    { key: 'variable_name', label: 'Variabelenaam', type: 'text', placeholder: 'mijn_variabele' },
    { key: 'variable_lifetime', label: 'Levensduur', type: 'select', options: ['één cyclus', 'één uitvoering', 'twee uitvoeringen'] },
    { key: 'variable_value', label: 'Waarde', type: 'textarea', placeholder: '{{1.waarde}}' },
  ],
}
