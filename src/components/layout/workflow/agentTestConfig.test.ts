/**
 * agentTestConfig.test — verdict finding 1 (BLOCKING): the config sent to the
 * PAID /ai/agents/test endpoint must never carry the raw `instructions` array,
 * since AgentChatService.php:78's legacy fallback would cast it to the literal
 * string "Array" as the persona (§0 API-CREDITS-1). Asserts the built payload
 * shape, not merely that a function runs.
 */
import { describe, it, expect } from 'vitest'
import { buildTestConfig } from './agentTestConfig'

describe('buildTestConfig', () => {
  it('keeps an existing persona and drops the instructions array entirely', () => {
    const out = buildTestConfig({
      instruction: 'persona',
      instructions: [{ id: 'q1', text: '<p>Vraag 1</p>' }],
    })
    expect(out.instruction).toBe('persona')
    expect('instructions' in out).toBe(false)
  })

  it('renders a numbered plain-text fallback persona when none is set yet', () => {
    const out = buildTestConfig({
      instructions: [{ id: 'q1', text: '<p>Vraag 1</p>' }],
    })
    expect(out.instruction).toBe('1. Vraag 1')
    expect('instructions' in out).toBe(false)
  })

  it('passes an empty/undefined config through without throwing', () => {
    expect(buildTestConfig(undefined)).toEqual({})
    expect(buildTestConfig({})).toEqual({})
  })
})
