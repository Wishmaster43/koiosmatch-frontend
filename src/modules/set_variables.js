import { StickyNote } from 'lucide-react'

export default {
  type:     'set_variables',
  category: 'Flow beheer',
  label:    'Variabelen instellen',
  Icon:     StickyNote,
  color:    '#D97706',
  bg:       '#FEF3C7',
  schema: [
    { key: 'variables', label: 'Variabelen', type: 'keyvalue', help: 'Naam → waarde paren om in te stellen.' },
    { key: 'variable_lifetime', label: 'Levensduur', type: 'select', options: ['één cyclus', 'één uitvoering', 'twee uitvoeringen'] },
  ],
}
