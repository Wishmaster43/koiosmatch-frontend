// ai_match module — let Koios AI propose candidates for a vacancy (requires AI agents).
import { Sparkles } from 'lucide-react'

export default {
  type:  'ai_match',
  module: 'aiagents',
  category: 'Matches',
  label: 'AI-kandidaatvoorstellen',
  Icon:  Sparkles,
  color: 'var(--module-mauve)',
  bg:    'color-mix(in srgb, var(--module-mauve) 16%, transparent)',
  schema: [
    { key: 'source',         label: 'Bron',           type: 'select', options: ['vacancy'] },
    { key: 'max_candidates', label: 'Max. kandidaten', type: 'number', placeholder: '10' },
  ],
}
