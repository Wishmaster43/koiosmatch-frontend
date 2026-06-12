import { Bot } from 'lucide-react'

export default {
  type:  'ai_agent',
  category: 'AI',
  label: 'AI Agent',
  Icon:  Bot,
  color: '#7C3AED',
  bg:    '#F5F3FF',
  schema: [
    { key: 'agent_name',           label: 'Agent naam',              type: 'text',   placeholder: 'Yessy AI' },
    { key: 'model',                label: 'Model',                   type: 'select', options: ['large','small','reasoning'] },
    { key: 'reasoning_effort',     label: 'Redeneersterkte',         type: 'select', options: ['low','medium','high'] },
    { key: 'system_prompt',        label: 'Instructies (systeem)',   type: 'textarea', placeholder: 'Je bent Yessy AI...' },
    { key: 'input',                label: 'Input bericht',           type: 'text',   placeholder: '{{bericht}}' },
    { key: 'max_history',          label: 'Max. conversatiehistorie',type: 'number', placeholder: '10' },
    { key: 'use_knowledge_base',   label: 'Kennisbank gebruiken',    type: 'boolean' },
  ],
}
