// ai_agent module — run a saved AI agent on the input and return its reply (requires the AI Agent app).
import { Bot } from 'lucide-react'

export default {
  type:     'ai_agent',
  app:      'ai_agent',
  category: 'AI',
  label:    'AI Agent',
  Icon:     Bot,
  color:    '#7C3AED',
  bg:       '#F5F3FF',
  schema: [
    {
      key:         'agent_id',
      label:       'Agent selecteren',
      type:        'agent_select',
      placeholder: 'Kies een geconfigureerde agent…',
      required:    true,
      hint:        'Beheer agents via AI Agents in het menu',
    },
    {
      key:         'input',
      label:       'Input bericht',
      type:        'text',
      placeholder: '{{bericht}}',
    },
    {
      key:         'max_history',
      label:       'Max. conversatiehistorie',
      type:        'number',
      placeholder: '10',
    },
  ],
}
