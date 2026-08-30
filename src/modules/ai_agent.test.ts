/**
 * ai_agent.test — INTERVIEW-WORKFLOW-1: the extended schema carries the
 * agent_id lookup, the fixed 'whatsapp' channel, the knowledge toggles, the
 * instruction list and the rejection-mode override, each with the
 * defaults/showIf the ConfigPanel and the engine both rely on. A plain
 * schema-shape test (no render) — the render-seam is covered by
 * configPanelInstructionList.test.tsx.
 */
import { describe, it, expect } from 'vitest'
import aiAgent from './ai_agent'

const byKey = (key: string) => aiAgent.schema.find(f => f.key === key)

describe('ai_agent module schema · agent + channel + sender', () => {
  it('agent_id is a real id-valued lookup_select (renamed from the old name-valued "agent")', () => {
    expect(byKey('agent_id')).toMatchObject({ type: 'lookup_select', endpoint: '/ai/agents', valueKey: 'id' })
    expect(byKey('agent')).toBeUndefined()
  })

  it('channel stays a fixed "whatsapp"-only select (P1 = WABA/Coexistence only, no wa_web trio)', () => {
    const field = byKey('channel')!
    expect(field.type).toBe('select')
    expect(field.options).toEqual(['whatsapp'])
    expect(field.default).toBe('whatsapp')
  })

  it('phone_number_id is required and always visible (no showIf, no whatsapp_number_id sibling)', () => {
    const field = byKey('phone_number_id')!
    expect(field.type).toBe('whatsapp_phone_number')
    expect(field.required).toBe(true)
    expect(field.showIf).toBeUndefined()
    expect(byKey('whatsapp_number_id')).toBeUndefined()
  })
})

describe('ai_agent module schema · knowledge toggles', () => {
  it('use_external_knowledge and use_faq are boolean fields defaulting to true', () => {
    expect(byKey('use_external_knowledge')).toMatchObject({ type: 'boolean', default: true })
    expect(byKey('use_faq')).toMatchObject({ type: 'boolean', default: true })
  })
})

describe('ai_agent module schema · instructions list', () => {
  it('registers the instructions field as the new instruction_list control', () => {
    expect(byKey('instructions')).toMatchObject({ type: 'instruction_list' })
  })

  it('keeps the instruction textarea as a persona/tone addendum, still required', () => {
    const field = byKey('instruction')!
    expect(field.type).toBe('textarea')
    expect(field.required).toBe(true)
    expect(field.hint).toMatch(/naast de instructies hierboven/)
  })
})

describe('ai_agent module schema · rejection mode', () => {
  it('defaults to inherit, offering inherit/proposal/automatic', () => {
    const field = byKey('rejection_mode')!
    expect(field.type).toBe('select')
    expect(field.default).toBe('inherit')
    expect(field.options).toEqual(['inherit', 'proposal', 'automatic'])
  })
})

describe('ai_agent module schema · pre-existing fields untouched', () => {
  it('keeps reply_timeout_hours/max_attempts defaults', () => {
    expect(byKey('reply_timeout_hours')).toMatchObject({ type: 'number', default: 48 })
    expect(byKey('max_attempts')).toMatchObject({ type: 'number', default: 3 })
  })
})
