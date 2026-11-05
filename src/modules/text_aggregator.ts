// text_aggregator module — concatenate text from multiple bundles into one string.
import { AlignLeft } from 'lucide-react'

export default {
  type:     'text_aggregator',
  category: 'flow',
  label:    'Text aggregator',
  Icon:     AlignLeft,
  color:    'var(--module-info)',
  bg:       'var(--color-info-bg)',
  schema: [
    { key: 'source_module', label: 'Source module', type: 'text', placeholder: 'automatisch ingevuld' },
    { key: 'row_separator', label: 'Separator', type: 'select', options: ['Nieuwe regel', 'Komma', 'Puntkomma', 'Spatie', 'Geen'] },
    { key: 'text', label: 'Text', type: 'textarea', placeholder: '{{1.naam}}' },
  ],
}
