// text_aggregator module — concatenate text from multiple bundles into one string.
import { AlignLeft } from 'lucide-react'

export default {
  type:     'text_aggregator',
  category: 'Flow beheer',
  label:    'Tekst samenvoegen',
  Icon:     AlignLeft,
  color:    '#0369A1',
  bg:       'var(--color-info-bg)',
  schema: [
    { key: 'source_module', label: 'Bronmodule', type: 'text', placeholder: 'automatisch ingevuld' },
    { key: 'row_separator', label: 'Scheidingsteken', type: 'select', options: ['Nieuwe regel', 'Komma', 'Puntkomma', 'Spatie', 'Geen'] },
    { key: 'text', label: 'Tekst', type: 'textarea', placeholder: '{{1.naam}}' },
  ],
}
