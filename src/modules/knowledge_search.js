// knowledge_search module — search the knowledge base (requires the AI Agent app).
import { BookOpen } from 'lucide-react'

export default {
  type:  'knowledge_search',
  app:   'ai_agent',
  category: 'AI',
  label: 'Kennisbank Zoeken',
  Icon:  BookOpen,
  color: '#0F6E56',
  bg:    '#E1F5EE',
  schema: [
    { key: 'query',       label: 'Zoekopdracht',    type: 'text',   placeholder: '{{vraag van kandidaat}}' },
    { key: 'limit',       label: 'Max. resultaten', type: 'number', placeholder: '50' },
    { key: 'files',       label: 'Kennisbestanden', type: 'multiselect', options: ['FAQ Yesway','Dienstinformatie','Contracten'] },
  ],
}
