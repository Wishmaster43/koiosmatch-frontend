// set_variables module — store multiple variables for use in later steps.
import { StickyNote } from 'lucide-react'

export default {
  type:     'set_variables',
  category: 'Flow beheer',
  label:    'Variabelen instellen',
  Icon:     StickyNote,
  // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
  color:    'var(--color-warning)',
  bg:       'var(--color-warning-bg)',
  schema: [
    { key: 'variables', label: 'Variabelen', type: 'keyvalue', help: 'Naam → waarde paren om in te stellen.' },
    { key: 'variable_lifetime', label: 'Levensduur', type: 'select', options: ['één cyclus', 'één uitvoering', 'twee uitvoeringen'] },
  ],
}
