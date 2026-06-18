// ai_agent module — AI agent block in the workflow builder
import { Bot } from 'lucide-react'

export default {
  type:     'ai_agent',
  // No `app` property → always visible in the module picker
  category: 'AI',
  label:    'AI Agents',
  Icon:     Bot,
  color:    '#7C3AED',
  bg:       '#F5F3FF',

  schema: [
    {
      key:         'naam',
      label:       'Naam',
      type:        'text',
      placeholder: 'Bijv. Yessy AI',
      hint:        'Geef dit agent-blok een herkenbare naam in de workflow.',
    },
    {
      key:      'connection',
      label:    'Agent',
      type:     'agent_select',
      required: true,
      hint:     'Selecteer de AI Agent verbinding die gebruikt wordt.',
    },
    {
      key:      'model',
      label:    'Model',
      type:     'select',
      required: true,
      default:  'recommended_large',
      options: [
        { value: 'recommended_large',  label: 'Aanbevolen: Groot' },
        { value: 'recommended_small',  label: 'Aanbevolen: Klein' },
        { value: 'gpt-4o',             label: 'GPT-4o' },
        { value: 'gpt-4o-mini',        label: 'GPT-4o Mini' },
        { value: 'claude-opus-4-8',    label: 'Claude Opus 4' },
        { value: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4' },
        { value: 'claude-haiku-4-5',   label: 'Claude Haiku 4' },
        { value: 'gemini-2.5-pro',     label: 'Gemini 2.5 Pro' },
        { value: 'gemini-2.5-flash',   label: 'Gemini 2.5 Flash' },
      ],
    },
    {
      key:         'instructions',
      label:       'Instructies',
      type:        'textarea',
      placeholder: 'Je bent een agent gespecialiseerd in...',
      hint:        'Beschrijf de rol en het gedrag van de agent.',
    },
    {
      key:   'faq_ids',
      label: "FAQ's koppelen",
      type:  'faq_select',
      hint:  'Koppel FAQ-bronnen die de agent mag raadplegen.',
    },
    {
      key:   'use_knowledge',
      label: 'Kennisbank gebruiken',
      type:  'boolean',
      hint:  'Geef de agent toegang tot de gekoppelde kennisbank.',
    },
    {
      key:         'input',
      label:       'Input',
      type:        'textarea',
      required:    true,
      placeholder: 'Taken of informatie voor de agent om te verwerken...',
      hint:        'De inkomende data of taak. Wijs waarden toe vanuit eerdere modules.',
    },
    {
      key:         'conversation_id',
      label:       'Conversatie ID',
      type:        'text',
      placeholder: '',
      hint:        'Hiermee kan de agent conversatiegeschiedenis bijhouden.',
    },
    {
      key:     'max_history',
      label:   'Max. conversatiegeschiedenis',
      type:    'number',
      default: 10,
      hint:    'Maximaal aantal antwoorden dat de agent als context gebruikt.',
    },
    {
      key:      'response_format',
      label:    'Responsformaat',
      type:     'select',
      required: true,
      default:  'text',
      options: [
        { value: 'text',           label: 'Tekst' },
        { value: 'data_structure', label: 'Datastructuur' },
      ],
    },
    {
      key:    'response_structure',
      label:  'Responsstructuur',
      type:   'response_structure',
      showIf: { key: 'response_format', value: 'data_structure' },
      hint:   'Definieer de velden die de agent teruggeeft.',
    },
  ],
}
