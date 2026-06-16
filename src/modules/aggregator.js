// aggregator module — merge the bundles produced by a previous step into a single array.
import { Combine } from 'lucide-react'

export default {
  type:  'aggregator',
  category: 'Flow beheer',
  label: 'Aggregator',
  Icon:  Combine,
  color: '#0369A1',
  bg:    '#E0F2FE',
  schema: [
    {
      key:   'source_module',
      label: 'Bronmodule',
      type:  'text',
      placeholder: 'bijv. Iterator (automatisch ingevuld)',
      help:  'De module waarvan de items worden samengevoegd. Normaal de Iterator die voor deze module staat.',
    },
    {
      key:   'aggregated_fields',
      label: 'Samen te voegen velden',
      type:  'keyvalue',
      help:  'Velden die per item worden verzameld in de output-array.',
    },
    {
      key:   'group_by',
      label: 'Groeperen op',
      type:  'text',
      placeholder: 'bijv. {{klant_id}} — leeg laten voor één grote groep',
    },
    {
      key:   'stop_processing_after_empty',
      label: 'Stop als resultaat leeg is',
      type:  'boolean',
    },
  ],
}
