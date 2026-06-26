// iterator module — split an array so the following steps run once per item.
import { Repeat } from 'lucide-react'

export default {
  type:  'iterator',
  category: 'Flow beheer',
  label: 'Iterator',
  Icon:  Repeat,
  color: '#6D28D9',
  bg:    '#EDE9FE',
  schema: [
    {
      key:   'source_field',
      label: 'Array veld',
      type:  'text',
      placeholder: '{{1.output}} of leeg laten voor volledige output',
      help:  'Welk veld uit de vorige module bevat de array om over te itereren.',
    },
  ],
}
