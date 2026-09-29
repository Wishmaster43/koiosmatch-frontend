/**
 * koiosContextTypes — FIND-1 coverage: all 15 BE-resolvable tokens are
 * whitelisted, and sendChat forwards a contact/task ref in its request body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RESOLVABLE_CONTEXT_TYPES, isContextResolvable } from './koiosContextTypes'
import { sendChat } from './koiosApi'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { post: vi.fn(() => Promise.resolve({ data: { answer: 'test', steps: [] } })) },
}))

const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { mockPost.mockClear() })

const BE_TOKENS = [
  'candidate', 'application', 'vacancy', 'match', 'customer', 'opportunity',
  'location', 'customer_location', 'department', 'contact', 'workflow',
  'outreach_campaign', 'conversation', 'task', 'reference',
]

describe('RESOLVABLE_CONTEXT_TYPES', () => {
  it('whitelists all 15 backend-resolvable tokens', () => {
    for (const token of BE_TOKENS) {
      expect(isContextResolvable(token)).toBe(true)
    }
    expect(RESOLVABLE_CONTEXT_TYPES).toHaveLength(BE_TOKENS.length)
  })

  it('still rejects an unknown token', () => {
    expect(isContextResolvable('not_a_real_type')).toBe(false)
  })
})

describe('sendChat — FIND-1 context types', () => {
  it('forwards a contact and a task ref in the request body', async () => {
    await sendChat('hello', null, [
      { type: 'contact', id: 'ct-1', label: 'Fleur Smit' },
      { type: 'task', id: 'tk-1', label: 'Follow up' },
    ])
    const [, body] = mockPost.mock.calls[0]
    expect(body).toEqual(expect.objectContaining({
      message: 'hello',
      context: [{ type: 'contact', id: 'ct-1' }, { type: 'task', id: 'tk-1' }],
    }))
  })
})
