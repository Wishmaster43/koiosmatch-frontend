// get_variables module — read multiple stored workflow variables at once.
import { BookMarked } from 'lucide-react'

export default {
  type:     'get_variables',
  category: 'Flow beheer',
  label:    'Variabelen ophalen',
  Icon:     BookMarked,
  color:    'var(--module-info)',
  bg:       'var(--color-info-bg)',
  schema: [
    { key: 'variable_names', label: 'Variabelenamen', type: 'textarea', placeholder: 'naam_1\nnaam_2', help: 'Eén naam per regel.' },
  ],
}
