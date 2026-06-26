// get_variable module — read a single stored workflow variable.
import { BookMarked } from 'lucide-react'

export default {
  type:     'get_variable',
  category: 'Flow beheer',
  label:    'Variabele ophalen',
  Icon:     BookMarked,
  color:    '#0369A1',
  bg:       'var(--color-info-bg)',
  schema: [
    { key: 'variable_name', label: 'Variabelenaam', type: 'text', placeholder: 'mijn_variabele' },
  ],
}
