// ai_agent module — WF-AI-AGENT-NODE-FE-1: one turn of the WhatsApp AI interview
// loop (WA-INTERVIEW-1). The former FE card was a generic 13-field instruction
// builder with no engine counterpart behind it ("generic agent" stays a later
// product idea, not a node); this registers exactly the six fields of
// App\Workflow\Modules\AiAgentModule::configSchema(). Sources decided CMBE 23-08
// (WORKLIST.md): `agent` reads GET /ai/agents (a plain CRUD list, never an AI
// call itself — id becomes the stored value, name the label); `phone_number_id`
// reads the SAME /whatsapp-phone-numbers lookup the whatsapp_send step uses.
// INTERVIEW-WORKFLOW-1 (Danny's reference panel, 2026-08-30) extends the schema
// with a knowledge group (external knowledge base / FAQ toggles), the
// AI-instructions list (`instructions`, type 'instruction_list' — see
// fieldControls/InstructionListField) and a rejection-mode override.
// `instruction` stays as a persona/tone addendum: the per-question instructions
// now live in `instructions`. P1 stays WABA/Coexistence only over
// `phone_number_id` — a WhatsApp Web channel option is a separate, later post
// (CMBE INTERVIEW-WORKFLOW-1 Appendix C delta, 2026-08-30: the wa_web/
// whatsapp_number_id trio this schema briefly carried is reverted here — the
// engine's AiAgentModule never read `channel` and had no `whatsapp_number_id`
// key at all, so hiding phone_number_id behind a wa_web showIf was a fake
// affordance; that trio ships only once the backend actually accepts it).
// CMBE delta (same date): the agent field is renamed `agent_id`, a real
// lookup_select keyed on the agent's id (not its name). The ENGINE still
// resolves the agent by the legacy `agent` NAME today (AiAgentModule.php:154,
// `AiAgent::where('name', ...)`) — this is not yet done on the backend side.
// So LookupSelectField dual-writes BOTH `agent_id` and the legacy `agent`
// (name) on every pick, and ConfigPanel.tsx falls back to `config.agent` for
// display when `agent_id` is absent (a step saved before this rename). Both
// the dual-write and the display fallback are removed once CMBE's P1 lands
// and the engine resolves by `agent_id`.
import { Bot } from 'lucide-react'
import { tint } from '@/lib/tint'
import type { SchemaField } from './types'

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
    // ── Group "Agent" ────────────────────────────────────────────────────────
    // Stored value = the agent's id (uuid). ConfigPanel falls back to the legacy
    // `config.agent` (a name string) for one release when `agent_id` is absent.
    { key: 'agent_id', label: 'AI-agent', type: 'lookup_select', endpoint: '/ai/agents', valueKey: 'id', tab: 'general' },
    // P1 = WABA/Coexistence via phone_number_id only (see file docblock above).
    { key: 'channel', label: 'Kanaal', type: 'select', tab: 'general', default: 'whatsapp',
      options: ['whatsapp'] },
    // REQUIRED, like the engine's own schema: AiAgentModule::sendReply throws on an
    // empty phone_number_id before any send-path selection runs (Opus-measured) —
    // always visible, never hidden behind a channel showIf (P1 has one channel).
    { key: 'phone_number_id', label: 'Verzendnummer (voor de sessieantwoorden)', type: 'whatsapp_phone_number', endpoint: '/whatsapp-phone-numbers', tab: 'general', required: true },

    // ── Group "Kennis" ─────────────────────────────────────────────────────
    { key: 'use_external_knowledge', label: 'Externe kennisbank gebruiken', type: 'boolean', tab: 'general', default: true,
      hint: 'Laat de AI-agent tenant-documenten/kennisbank raadplegen tijdens het gesprek.' },
    { key: 'use_faq', label: "FAQ's gebruiken", type: 'boolean', tab: 'general', default: true,
      hint: 'Laat de AI-agent veelgestelde vragen (FAQ) raadplegen tijdens het gesprek.' },

    // ── Group "AI-instructies" ───────────────────────────────────────────────
    // The numbered, per-question instructions (arrow-button reorderable, rich
    // text + variable-insert menu + output-field mapping + a required toggle per row).
    { key: 'instructions', label: 'AI-instructies', type: 'instruction_list', tab: 'general',
      hint: 'De genummerde stappen die de AI-agent doorloopt, elk met een optioneel outputveld en variabele-chips.' },
    // Persona/tone addendum — the per-question content now lives in `instructions`
    // above; this stays for global persona/tone rules the engine still prepends.
    { key: 'instruction', label: 'Instructietekst (agent-prompt)', type: 'textarea', tab: 'general', required: true,
      hint: 'Extra persona- en toonaanwijzingen voor de AI-agent, naast de instructies hierboven. Het runtime-antwoordcontract wordt automatisch toegevoegd.' },

    // ── Group "Gedrag" ─────────────────────────────────────────────────────
    { key: 'reply_timeout_hours', label: 'Terugvaltijd zonder reactie (uren)', type: 'number', tab: 'advanced', default: 48,
      hint: 'Reageert de kandidaat niet, dan valt de run na dit aantal uren terug (workflows:resume-due watchdog).' },
    { key: 'max_attempts', label: 'Max. pogingen per beurt (bij een tijdelijke API-fout)', type: 'number', tab: 'advanced', default: 3 },
    // Per-vacancy override of the tenant-wide rejection setting (§3B axes:
    // rejection stays configurable, never hardcoded which stage/flow triggers it).
    { key: 'rejection_mode', label: 'Afwijzingsmodus', type: 'select', tab: 'advanced', default: 'inherit',
      options: ['inherit', 'proposal', 'automatic'],
      hint: 'Volgt standaard de tenant-instelling; deze vacature kan dat hier overschrijven.' },
  ] as SchemaField[],
}
