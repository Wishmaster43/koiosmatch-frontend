/**
 * ai_agent.test — MODULE-TERUG-1 (Danny 31-08): the module is the pre-P1
 * six-field engine schema again, plus ONLY the AI-instructions list on its own
 * panel tab. A plain schema-shape test (no render) — the render-seam is
 * covered by configPanelInstructionList.test.tsx.
 */
import { describe, it, expect } from 'vitest'
import aiAgent from './ai_agent'

const byKey = (key: string) => aiAgent.schema.find(f => f.key === key)

describe('ai_agent module schema · the restored pre-P1 base (MODULE-TERUG-1)', () => {
  it('agent is the name-valued lookup_select the engine resolves on', () => {
    expect(byKey('agent')).toMatchObject({ type: 'lookup_select', endpoint: '/ai/agents', valueKey: 'name' })
    expect(byKey('agent_id')).toBeUndefined()
  })

  it('channel stays a fixed "whatsapp"-only select', () => {
    const field = byKey('channel')!
    expect(field.type).toBe('select')
    expect(field.options).toEqual(['whatsapp'])
    expect(field.default).toBe('whatsapp')
  })

  it('instruction stays the required agent-prompt textarea', () => {
    const field = byKey('instruction')!
    expect(field.type).toBe('textarea')
    expect(field.required).toBe(true)
  })

  it('phone_number_id is a required lookup_select, always visible', () => {
    const field = byKey('phone_number_id')!
    expect(field.type).toBe('lookup_select')
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
    for (const gone of ['intro_template', 'rejection_mode', 'whatsapp_number_id', 'agent_id']) {
      expect(byKey(gone)).toBeUndefined()
    }
  })
})
