/**
 * WF-MODULE-RECONCILE-FE-1 — registry coverage guard. The eight engine modules
 * (task_create, appointment_create, calllist_add, webhook_send,
 * candidate_archive, experience_add, sm_employee_create, workflow_call) must
 * each have a registry card (MODULE_META entry) whose label resolves via
 * `t('modules.<type>')` in every shipped locale — a missing entry is exactly
 * what made saved workflows render "Onbekende module" (canvas.tsx). 'trigger'
 * is the engine-internal counter-case: it must stay off MODULE_META entirely.
 */
import { describe, it, expect } from 'vitest'
import MODULES, { MODULE_META, MODULE_SCHEMAS, ENGINE_INTERNAL_TYPES } from '@/modules/index'

// Every shipped locale's workflows.json, loaded the same way registryI18n.test.ts does.
const files = import.meta.glob('../i18n/locales/*/workflows.json', { eager: true, import: 'default' }) as Record<string, {
  modules?: Record<string, string>
}>
const LOCS = ['nl', 'en', 'de', 'fr', 'es']

const RECONCILED_TYPES = [
  'task_create', 'appointment_create', 'calllist_add', 'webhook_send',
  'candidate_archive', 'experience_add', 'sm_employee_create', 'workflow_call',
]

describe('WF-MODULE-RECONCILE-FE-1 · the eight engine modules get a registry card', () => {
  it.each(RECONCILED_TYPES)('%s is registered in the MODULES array', (type) => {
    expect(MODULES.some(m => m.type === type)).toBe(true)
  })

  it.each(RECONCILED_TYPES)('%s has a MODULE_META entry with a non-empty label/icon/category', (type) => {
    const meta = MODULE_META[type]
    expect(meta).toBeDefined()
    expect(meta.label).toBeTruthy()
    expect(meta.Icon).toBeTruthy()
    expect(meta.category).toBeTruthy()
  })

  for (const loc of LOCS) {
    it(`${loc}/workflows.json resolves modules.* for all eight types`, () => {
      const file = Object.entries(files).find(([p]) => p.includes(`/${loc}/`))?.[1]
      expect(file, `${loc}/workflows.json not found`).toBeTruthy()
      const missing = RECONCILED_TYPES.filter(type => !(file?.modules ?? {})[type])
      expect(missing, `missing modules.* in ${loc}: ${missing.join(', ')}`).toEqual([])
    })
  }

  it("'trigger' is marked engine-internal and never registered as a pickable module", () => {
    expect(ENGINE_INTERNAL_TYPES).toContain('trigger')
    expect(MODULE_META.trigger).toBeUndefined()
    expect(MODULES.some(m => m.type === 'trigger')).toBe(false)
  })
})

/**
 * WF-BUILDER-VELDEN-1 — config-schema KEY pins. Six modules' FE picker cards were
 * missing fields their engine `configSchema()` already defines (BE is the source of
 * truth, koiosmatch-api/app/Workflow/Modules/<Name>Module.php). Pinning every key
 * here means a future regression (a field dropped while refactoring a registry file)
 * fails loudly instead of silently reopening the gap.
 */
const EXPECTED_SCHEMA_KEYS: Record<string, string[]> = {
  // WA-SEND-FIELDS-2: body_parameters (ordered_list) and after_send_updates
  // (group of key_value, GroupField/KeyValueField) both have real FE controls
  // now and are pinned below. header_variables/variables are written by the
  // composite WhatsappTemplateField.
  whatsapp_send: [
    'purpose', 'message_type', 'channel', 'whatsapp_number_id', 'phone_number_id', 'template_name', 'language',
    'message_category', 'priority_type', 'dedup_hours', 'require_consent_field',
    'throttle_per_minute', 'recipient_field', 'session_text', 'body_parameters', 'after_send_updates',
  ],
  email_send: ['subject', 'body', 'sender_context', 'purpose', 'skip_if_consent_field', 'recipient_role'],
  notification_send: ['title', 'body', 'recipients', 'role', 'user_ids', 'type', 'link_entity'],
  candidate_filter: ['ai_enabled', 'pools', 'positions', 'status', 'last_contact_days', 'last_worked_days', 'no_show_max'],
  // effective_from deliberately absent: declared by the engine schema but never read by execute() (fake affordance).
  status_set: ['status', 'reason'],
  pdok_geocode: ['entity', 'candidate_id', 'only_missing', 'all_records'],
  // WF-WAIT-NODE-FE-1: the ONE merged 'wait' node — mirrors WaitModule::configSchema.
  wait: ['until_field', 'days', 'hours', 'skip_weekends'],
  // INTERVIEW-WORKFLOW-1 Appendix C (Danny 30-08) supersedes WF-AI-AGENT-NODE-FE-1
  // for ai_agent's key set (MODULE-TERUG-1, Danny 31-08: pre-P1 base + only the instructions list): the reduced 6-key node grows a knowledge group, the
  // instructions list and a rejection-mode override (see the describe block below).
  ai_agent: ['agent', 'instruction', 'instructions', 'max_attempts', 'reply_timeout_hours', 'use_external_knowledge', 'use_faq'],
}

describe('WF-BUILDER-VELDEN-1 · registry config-schema mirrors the engine exactly', () => {
  for (const [type, keys] of Object.entries(EXPECTED_SCHEMA_KEYS)) {
    it.each(keys)(`${type} schema has a '%s' field`, (key) => {
      const schema = MODULE_SCHEMAS[type]
      expect(schema, `${type} has no MODULE_SCHEMAS entry`).toBeDefined()
      expect(schema?.some(f => f.key === key), `${type} is missing config-schema key '${key}'`).toBe(true)
    })
  }

  it('email_send no longer carries the obsolete to/template fields (never read by EmailSendModule::execute)', () => {
    const keys = (MODULE_SCHEMAS.email_send ?? []).map(f => f.key)
    expect(keys).not.toContain('to')
    expect(keys).not.toContain('template')
  })

  it("notification_send's recipients options include 'users' (required for user_ids to be reachable)", () => {
    const recipients = (MODULE_SCHEMAS.notification_send ?? []).find(f => f.key === 'recipients')
    expect(recipients?.options).toContain('users')
  })
})

/**
 * WF-WAIT-NODE-FE-1 — the engine NEVER knew the FE 'delay'/'sleep' types (both
 * always rendered "Onbekende module", 0 stored steps across every tenant): both
 * are deleted outright, never migrated/aliased, and every use folds into the ONE
 * 'wait' node, mirroring WaitModule::configSchema exactly (no extra key beyond it).
 */
describe('WF-WAIT-NODE-FE-1 · delay/sleep deleted, wait mirrors WaitModule::configSchema exactly', () => {
  it('delay and sleep have no MODULE_META entry and are not in the MODULES array', () => {
    expect(MODULE_META.delay).toBeUndefined()
    expect(MODULE_META.sleep).toBeUndefined()
    expect(MODULES.some(m => m.type === 'delay')).toBe(false)
    expect(MODULES.some(m => m.type === 'sleep')).toBe(false)
  })

  it("wait's schema has EXACTLY the engine's four keys, nothing more", () => {
    const keys = (MODULE_SCHEMAS.wait ?? []).map(f => f.key).sort()
    expect(keys).toEqual(['days', 'hours', 'skip_weekends', 'until_field'])
  })
})

/**
 * WF-AI-AGENT-NODE-FE-1 — the generic 13-field instruction builder had no engine
 * counterpart ("generic agent" stays a later product idea, not a node); ai_agent
 * originally mirrored AiAgentModule::configSchema exactly, six keys, nothing more.
 *
 * INTERVIEW-WORKFLOW-1 Appendix C (Danny 30-08) supersedes WF-AI-AGENT-NODE-FE-1
 * for the keys below: `instructions` and `use_knowledge`'s intent are back —
 * `instructions` as the new numbered instruction-list field, and the knowledge
 * toggle as `use_external_knowledge`/`use_faq` — both a deliberate CMBE-accepted
 * schema growth, not a regression to the deleted 13-field builder. Every OTHER
 * dead key from that builder (naam/input/faq_ids/response_format/…) stays dead.
 */
describe('WF-AI-AGENT-NODE-FE-1 · the 13-field builder is gone; INTERVIEW-WORKFLOW-1 grows the schema deliberately', () => {
  it("ai_agent's schema has exactly the CMBE-accepted key set, nothing more", () => {
    const keys = (MODULE_SCHEMAS.ai_agent ?? []).map(f => f.key).sort()
    expect(keys).toEqual(['agent', 'instruction', 'instructions', 'max_attempts', 'reply_timeout_hours', 'use_external_knowledge', 'use_faq'])
  })

  it('none of the OTHER old 13-field builder keys survive (instructions/use_knowledge are back under new names, see above)', () => {
    const keys = (MODULE_SCHEMAS.ai_agent ?? []).map(f => f.key)
    const dead = [
      'naam', 'input', 'faq_ids', 'response_format',
      'response_structure', 'system_prefix', 'conversation_id', 'max_history',
      'temperature', 'max_tokens', 'step_timeout',
    ]
    for (const key of dead) expect(keys).not.toContain(key)
  })
})
