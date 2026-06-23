// ai_match module — let Koios AI propose candidates for a vacancy (requires AI agents).
import { Sparkles } from 'lucide-react'

export default {
  type:  'ai_match',
  app:   'aiagents',
  category: 'Matches',
  label: 'AI-kandidaatvoorstellen',
  Icon:  Sparkles,
  color: '#C98BBA',
  bg:    '#F7EAF3',
  schema: [
    { key: 'source',         label: 'Bron',           type: 'select', options: ['vacancy'] },
    { key: 'max_candidates', label: 'Max. kandidaten', type: 'number', placeholder: '10' },
  ],
}
