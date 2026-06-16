// get_variables module — read multiple stored workflow variables at once.
import { BookMarked } from 'lucide-react'

export default {
  type:     'get_variables',
  category: 'Flow beheer',
  label:    'Variabelen ophalen',
  Icon:     BookMarked,
  color:    '#0369A1',
  bg:       '#E0F2FE',
  schema: [
    { key: 'variable_names', label: 'Variabelenamen', type: 'textarea', placeholder: 'naam_1\nnaam_2', help: 'Eén naam per regel.' },
  ],
}
