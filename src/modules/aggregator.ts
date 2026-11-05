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
      placeholder: 'e.g. Iterator (filled automatically)',
      help:  'The module whose items are merged. Usually the Iterator right before this module.',
    },
    {
      key:   'aggregated_fields',
      label: 'Fields to merge',
      type:  'keyvalue',
      help:  'Fields collected per item into the output array.',
    },
    {
      key:   'group_by',
      label: 'Group by',
      type:  'text',
      placeholder: 'e.g. {{klant_id}}. Leave empty for one big group',
    },
    {
      key:   'stop_processing_after_empty',
      label: 'Stop when the result is empty',
      type:  'boolean',
    },
  ],
}
