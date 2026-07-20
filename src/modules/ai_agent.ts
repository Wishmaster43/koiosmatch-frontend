// ai_agent module — AI agent block in the workflow builder
import { Bot } from 'lucide-react'

export default {
  type:     'ai_agent',
  // No `app` property → always visible in the module picker
  category: 'AI',
  label:    'AI Agents',
  Icon:     Bot,
  color:    'var(--color-violet)',
  // eslint-disable-next-line no-restricted-syntax -- deliberately lighter than --color-violet-bg to visually separate the AI category from the parser family
  bg:       '#F5F3FF',

  schema: [
    // ── Standaard tab ────────────────────────────────────────────────────────
    {
      key:         'naam',
      label:       'Naam',
      type:        'text',
      tab:         'standaard',
      placeholder: 'Bijv. Yessy AI',
      hint:        'Geef dit agent-blok een herkenbare naam in de workflow.',
    },
    // MODEL-1 (2026-07-20): the backend no longer accepts/returns a per-step
    // model — one company-wide model (Settings → Policy::defaultModel) runs
    // every AI step. A workflow saved before this change may still carry a
    // stale `model` key in its config; that key is simply never read/written
    // here anymore, so it stays inert instead of crashing (defensive-ignore).
    {
      key:         'instructions',
      label:       'Instructies',
      type:        'textarea',
      tab:         'standaard',
      placeholder: 'Je bent een agent gespecialiseerd in...',
      hint:        'Beschrijf de rol en het gedrag van de agent.',
    },
    {
      key:         'input',
      label:       'Input',
      type:        'textarea',
      tab:         'standaard',
      required:    true,
      placeholder: 'Taken of informatie voor de agent om te verwerken...',
      hint:        'De inkomende data of taak. Gebruik {{module.veld}} om waarden uit eerdere stappen te koppelen.',
    },
    {
      key:   'faq_ids',
      label: "FAQ's koppelen",
      type:  'faq_select',
      tab:   'standaard',
      hint:  'Koppel FAQ-bronnen die de agent mag raadplegen.',
    },
    {
      key:   'use_knowledge',
      label: 'Kennisbank gebruiken',
      type:  'boolean',
      tab:   'standaard',
      hint:  'Geef de agent toegang tot de gekoppelde kennisbank.',
    },
    {
      key:      'response_format',
      label:    'Responsformaat',
      type:     'select',
      tab:      'standaard',
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
      tab:    'standaard',
      showIf: { key: 'response_format', value: 'data_structure' },
      hint:   'Definieer de velden die de agent teruggeeft.',
    },

    // ── Geavanceerd tab ──────────────────────────────────────────────────────
    {
      key:         'system_prefix',
      label:       'Systeem-prefix',
      type:        'textarea',
      tab:         'geavanceerd',
      placeholder: 'Extra systeeminstructies die vóór alle andere instructies worden geplaatst...',
      hint:        'Wordt voor de instructies ingevoegd. Gebruik dit voor tenant-brede regels.',
    },
    {
      key:         'conversation_id',
      label:       'Conversatie ID',
      type:        'text',
      tab:         'geavanceerd',
      placeholder: '{{trigger.session_id}}',
      hint:        'Hiermee kan de agent conversatiegeschiedenis bijhouden over meerdere runs.',
    },
    {
      key:     'max_history',
      label:   'Max. conversatiegeschiedenis',
      type:    'number',
      tab:     'geavanceerd',
      default: 10,
      hint:    'Maximaal aantal berichten dat als context meegegeven wordt.',
    },
    {
      key:     'temperature',
      label:   'Temperature',
      type:    'number',
      tab:     'geavanceerd',
      default: 0.7,
      hint:    '0 = deterministisch · 1 = creatief. Standaard 0.7.',
    },
    {
      key:     'max_tokens',
      label:   'Max. output tokens',
      type:    'number',
      tab:     'geavanceerd',
      default: 1024,
      hint:    'Maximaal aantal tokens in het antwoord van de agent.',
    },
    {
      key:     'step_timeout',
      label:   'Timeout (seconden)',
      type:    'number',
      tab:     'geavanceerd',
      default: 60,
      hint:    'Na hoeveel seconden de stap als mislukt wordt beschouwd.',
    },
  ],
}
