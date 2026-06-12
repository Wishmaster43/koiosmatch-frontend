import { Regex } from 'lucide-react'

export default {
  type:     'advanced_parser',
  category: 'Tekst & Parsing',
  label:    'Geavanceerde verwerker',
  Icon:     Regex,
  color:    '#7C3AED',
  bg:       '#EDE9FE',
  schema: [
    { key: 'text', label: 'Tekst', type: 'textarea', placeholder: '{{1.inhoud}}' },
    { key: 'pattern', label: 'Patroon (regex)', type: 'text', placeholder: '(?P<naam>\\w+)' },
    { key: 'global', label: 'Alle overeenkomsten', type: 'boolean' },
    { key: 'case_insensitive', label: 'Hoofdletterongevoelig', type: 'boolean' },
    { key: 'multiline', label: 'Meerdere regels', type: 'boolean' },
  ],
}
