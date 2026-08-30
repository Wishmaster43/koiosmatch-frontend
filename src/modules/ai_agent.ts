// ai_agent module — WF-AI-AGENT-NODE-FE-1: one turn of the WhatsApp AI interview
// loop (WA-INTERVIEW-1). The former FE card was a generic 13-field instruction
// builder with no engine counterpart behind it ("generic agent" stays a later
// product idea, not a node); this registers exactly the six fields of
// App\Workflow\Modules\AiAgentModule::configSchema(). Sources decided CMBE 23-08
// (WORKLIST.md): `agent` reads GET /ai/agents (a plain CRUD list, never an AI
// call itself — id becomes the stored value, name the label); `phone_number_id`
// reads the SAME /whatsapp-phone-numbers lookup the whatsapp_send step uses.
import { Bot } from 'lucide-react'
import { tint } from '@/lib/tint'

export default {
  type:     'ai_agent',
  // No `app` property → always visible in the module picker
  category: 'AI',
  label:    'AI Agents',
  Icon:     Bot,
  color:    'var(--color-violet)',
  // Lighter mix than --color-violet-bg (~14%) so the AI category visually separates from the parser family.
  bg:       tint('var(--color-violet)', 6),
  schema: [
    // Stored value = the agent NAME: AiAgentModule resolves `AiAgent::where('name', …)`
    // and its own schema offers pluck('name') (Opus-measured) — an id would match nobody.
    { key: 'agent', label: 'AI-agent', type: 'lookup_select', endpoint: '/ai/agents', valueKey: 'name', tab: 'general' },
    { key: 'channel', label: 'Kanaal', type: 'select', tab: 'general', default: 'whatsapp',
      options: ['whatsapp'] },
    { key: 'instruction', label: 'Instructietekst (agent-prompt)', type: 'textarea', tab: 'general', required: true,
      hint: 'De volledige, tenant-bewerkbare instructie voor de AI-agent: persona, staps-state-machine, harde regels. Het runtime-antwoordcontract wordt automatisch toegevoegd.' },
    // REQUIRED, like the engine's own schema: AiAgentModule::sendReply throws on an
    // empty phone_number_id before any send-path selection runs (Opus-measured) —
    // the WA-SCOPE-2 fallback lives in the WhatsApp send path this module never
    // reaches, so a "leave empty" promise here would be a fake affordance.
    { key: 'phone_number_id', label: 'Verzendnummer (voor de sessieantwoorden)', type: 'lookup_select', endpoint: '/whatsapp-phone-numbers', tab: 'general', required: true },
    // MODULE-TERUG-1 (Danny 31-08, verbatim: "de AI agent moet terug komen zoals
    // het was ik vroeg alleen om titel voor AI instructie, pop-out of popup voor
    // de tekst en AI instructies op tabje"): the module is this pre-P1 schema
    // again, plus ONLY the AI-instructions list below on its own panel tab.
    { key: 'instructions', label: 'AI-instructies', type: 'instruction_list', tab: 'instructions',
      hint: 'De genummerde stappen die de AI-agent doorloopt, elk met een optioneel outputveld en variabele-chips.' },
    { key: 'reply_timeout_hours', label: 'Terugvaltijd zonder reactie (uren)', type: 'number', tab: 'advanced', default: 48,
      hint: 'Reageert de kandidaat niet, dan valt de run na dit aantal uren terug (workflows:resume-due watchdog).' },
    { key: 'max_attempts', label: 'Max. pogingen per beurt (bij een tijdelijke API-fout)', type: 'number', tab: 'advanced', default: 3 },
  ],
}
