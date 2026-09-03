/**
 * koiosApi — tests for the sendChat function with flavor/effort parameters.
 * K-147: verify that flavor and effort are sent only when set, not when undefined.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendChat } from './koiosApi'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { answer: 'test', steps: [] } })),
  },
}))

const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockPost.mockClear()
})

describe('sendChat', () => {
  it('sends only message when no optional params are set', async () => {
    mockPost.mockResolvedValueOnce({ data: { answer: 'test', steps: [] } })
    await sendChat('hello')
    const [, body] = mockPost.mock.calls[0]
    expect(body).toEqual({ message: 'hello' })
  })

  it('includes model in body when provided', async () => {
    mockPost.mockResolvedValueOnce({ data: { answer: 'test', steps: [] } })
    await sendChat('hello', 'claude-haiku-4-5', [])
    const callBody = mockPost.mock.calls[0][1]
    expect(callBody).toEqual(expect.objectContaining({
      message: 'hello',
      model: 'claude-haiku-4-5',
    }))
  })

  it('includes flavor in body when provided and not null', async () => {
    mockPost.mockResolvedValueOnce({ data: { answer: 'test', steps: [] } })
    await sendChat('hello', null, [], 'snel', null)
    const callBody = mockPost.mock.calls[0][1]
    expect(callBody).toEqual(expect.objectContaining({
      message: 'hello',
      flavor: 'snel',
    }))
    expect(callBody.model).toBeUndefined()
    expect(callBody.effort).toBeUndefined()
  })

  it('includes effort in body when provided and not null', async () => {
    mockPost.mockResolvedValueOnce({ data: { answer: 'test', steps: [] } })
    await sendChat('hello', null, [], null, 'high')
    const callBody = mockPost.mock.calls[0][1]
    expect(callBody).toEqual(expect.objectContaining({
      message: 'hello',
      effort: 'high',
    }))
    expect(callBody.model).toBeUndefined()
    expect(callBody.flavor).toBeUndefined()
  })

  it('includes both flavor and effort when both provided', async () => {
    mockPost.mockResolvedValueOnce({ data: { answer: 'test', steps: [] } })
    await sendChat('hello', null, [], 'slim', 'xhigh')
    const callBody = mockPost.mock.calls[0][1]
    expect(callBody).toEqual(expect.objectContaining({
      message: 'hello',
      flavor: 'slim',
      effort: 'xhigh',
    }))
  })

  it('does not include flavor in body when flavor is null', async () => {
    mockPost.mockResolvedValueOnce({ data: { answer: 'test', steps: [] } })
    await sendChat('hello', null, [], null, 'low')
    const callBody = mockPost.mock.calls[0][1]
    expect(callBody).not.toHaveProperty('flavor')
    expect(callBody).toHaveProperty('effort', 'low')
  })

  it('does not include effort in body when effort is null', async () => {
    mockPost.mockResolvedValueOnce({ data: { answer: 'test', steps: [] } })
    await sendChat('hello', null, [], 'max', null)
    const callBody = mockPost.mock.calls[0][1]
    expect(callBody).toHaveProperty('flavor', 'max')
    expect(callBody).not.toHaveProperty('effort')
  })

  it('includes context when provided', async () => {
    mockPost.mockResolvedValueOnce({ data: { answer: 'test', steps: [] } })
    const context = [{ type: 'candidate' as const, id: 'c-1', label: 'Test' }]
    await sendChat('hello', null, context, null, null)
    const callBody = mockPost.mock.calls[0][1]
    expect(callBody.context).toEqual([{ type: 'candidate', id: 'c-1' }])
  })

  // VOICE-MODE-1: voice_mode is only ever sent as `true` — never `false`/null.
  it('includes voice_mode: true in body when voiceMode is true', async () => {
    mockPost.mockResolvedValueOnce({ data: { answer: 'test', steps: [] } })
    await sendChat('hello', null, [], null, null, true)
    const callBody = mockPost.mock.calls[0][1]
    expect(callBody).toEqual(expect.objectContaining({ message: 'hello', voice_mode: true }))
  })

  it('does not include voice_mode in body when voiceMode is false or unset', async () => {
    mockPost.mockResolvedValueOnce({ data: { answer: 'test', steps: [] } })
    await sendChat('hello', null, [], null, null, false)
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('voice_mode')

    mockPost.mockResolvedValueOnce({ data: { answer: 'test', steps: [] } })
    await sendChat('hello')
    expect(mockPost.mock.calls[1][1]).not.toHaveProperty('voice_mode')
  })
})
