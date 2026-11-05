// set_variable module — store a single variable for use in later steps.
import { StickyNote } from 'lucide-react'

export default {
  type:     'set_variable',
  category: 'flow',
  label:    'Set variable',
  Icon:     StickyNote,
  // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
  color:    'var(--color-warning)',
  bg:       'var(--color-warning-bg)',
  schema: [
    { key: 'variable_name', label: 'Variable name', type: 'text', placeholder: 'my_variable' },
    { key: 'variable_lifetime', label: 'Lifetime', type: 'select', options: ['één cyclus', 'één uitvoering', 'twee uitvoeringen'] },
    { key: 'variable_value', label: 'Value', type: 'textarea', placeholder: '{{1.waarde}}' },
  ],
}
