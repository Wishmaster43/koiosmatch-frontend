/**
 * ai_agent.test — MODULE-TERUG-1 (Danny 31-08): the module is the pre-P1
 * six-field engine schema again, plus ONLY the AI-instructions list on its own
 * panel tab. A plain schema-shape test (no render) — the render-seam is
 * covered by configPanelInstructionList.test.tsx.
 * AI-AGENT-STEP-LANGUAGE-1 (Danny 27-11, Q21 yes): plus the audience select on the
 * advanced tab, mirroring AiAgentModule::configSchema 'audience'.
 */
import { describe, it, expect } from 'vitest'
import aiAgent from './ai_agent'

const byKey = (key: string) => aiAgent.schema.find(f => f.key === key)

describe('ai_agent module schema · the restored pre-P1 base (MODULE-TERUG-1)', () => {
  it('agent is the name-valued lookup_select the engine resolves on', () => {
    expect(byKey('agent')).toMatchObject({ type: 'lookup_select', endpoint: '/ai/agents', valueKey: 'name' })
    expect(byKey('agent_id')).toBeUndefined()
  })

  it('instruction stays the required agent-prompt textarea', () => {
    const field = byKey('instruction')!
    expect(field.type).toBe('textarea')
    expect(field.required).toBe(true)
  })

  it('keeps reply_timeout_hours/max_attempts defaults', () => {
    expect(byKey('reply_timeout_hours')).toMatchObject({ type: 'number', default: 48 })
    expect(byKey('max_attempts')).toMatchObject({ type: 'number', default: 3 })
  })
})

describe('ai_agent module schema · the ONE addition Danny asked for', () => {
  it('registers the instructions list on its own panel tab', () => {
    expect(byKey('instructions')).toMatchObject({ type: 'instruction_list', tab: 'instructions' })
  })

  it('the knowledge toggles are back on the module (Danny 31-08 confirm), defaulting on', () => {
    expect(byKey('use_external_knowledge')).toMatchObject({ type: 'boolean', default: true })
    expect(byKey('use_faq')).toMatchObject({ type: 'boolean', default: true })
  })

  it('carries NONE of the reverted P1 extras (intro_template, rejection_mode)', () => {
    for (const gone of ['intro_template', 'rejection_mode', 'whatsapp_number_id', 'agent_id', 'channel', 'phone_number_id']) {
      expect(byKey(gone)).toBeUndefined()
    }
  })
})

describe('ai_agent module schema · AI-AGENT-STEP-LANGUAGE-1 audience select (Danny 27-11)', () => {
  it('audience is a select on the advanced tab that defaults to candidate', () => {
    expect(byKey('audience')).toMatchObject({ type: 'select', tab: 'advanced', default: 'candidate' })
  })

  it('offers exactly the two engine audiences as {value,label} options, candidate first', () => {
    const options = byKey('audience')!.options as Array<{ value: string; label: string }>
    expect(options.map(o => o.value)).toEqual(['candidate', 'staff'])
    expect(options.map(o => o.label)).toEqual(['Candidate (their language)', 'Staff (company language)'])
  })

  it('carries a hint and sits last in the schema (after max_attempts, so it renders last on the advanced tab)', () => {
    expect(typeof byKey('audience')!.hint).toBe('string')
    expect(aiAgent.schema[aiAgent.schema.length - 1].key).toBe('audience')
  })
})
