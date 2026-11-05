// aggregator module — merge the bundles produced by a previous step into a single array.
import { Combine } from 'lucide-react'

export default {
  type:  'aggregator',
  category: 'flow',
  label: 'Aggregator',
  Icon:  Combine,
  color: 'var(--module-info)',
  bg:    'var(--color-info-bg)',
  schema: [
    {
      key:   'source_module',
      label: 'Source module',
      type:  'text',
      placeholder: 'bijv. Iterator (automatisch ingevuld)',
      help:  'De module waarvan de items worden samengevoegd. Normaal de Iterator die voor deze module staat.',
    },
    {
      key:   'aggregated_fields',
      label: 'Fields to merge',
      type:  'keyvalue',
      help:  'Velden die per item worden verzameld in de output-array.',
    },
    {
      key:   'group_by',
      label: 'Group by',
      type:  'text',
      placeholder: 'bijv. {{klant_id}} — leeg laten voor één grote groep',
    },
    {
      key:   'stop_processing_after_empty',
      label: 'Stop when the result is empty',
      type:  'boolean',
    },
  ],
}
