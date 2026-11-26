/**
 * useConversationSend — asserts the exact send request (route, body, Idempotency-Key),
 * the single-request latch, the 202 outbox stub + queued refresh, the error paths
 * and the empty-draft guard (SHARED-UNIT-TEST-1, §13).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import api from '@/lib/api'
import { useConversationSend, useQueuedMessageRefresh, QUEUED_REFRESH_DELAYS_MS } from './useConversationSend'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const setup = () => {
  const setMessages = vi.fn()
  const refreshRows = vi.fn()
  const hook = renderHook(() => useConversationSend('c1', setMessages, refreshRows))
  return { ...hook, setMessages, refreshRows }
}

afterEach(() => vi.clearAllMocks())

describe('useConversationSend', () => {
  it('POSTs { direction, message_content } with an Idempotency-Key and clears the draft on 201', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 201, data: { id: 'm1', message_content: 'hi' } })
    const { result, setMessages, refreshRows } = setup()
    act(() => result.current.setComposerText('  hi '))
    await act(async () => { result.current.sendMessage('c1') })
    const [url, body, config] = vi.mocked(api.post).mock.calls[0] as [string, unknown, { headers: Record<string, string> }]
    expect(url).toBe('/conversations/c1/messages')
    expect(body).toEqual({ direction: 'outbound', message_content: 'hi' })
    expect(config.headers['Idempotency-Key']).toBeTruthy()
    expect(setMessages).toHaveBeenCalled()
    expect(refreshRows).toHaveBeenCalled()
    expect(result.current.composerText).toBe('')
  })

  it('adds text_template_id only when picked, then clears it after a 201', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 201, data: { id: 'm1' } })
    const { result } = setup()
    act(() => { result.current.setComposerText('hi'); result.current.setTextTemplateId('t1') })
    await act(async () => { result.current.sendMessage('c1') })
    expect(vi.mocked(api.post).mock.calls[0][1]).toEqual({ direction: 'outbound', message_content: 'hi', text_template_id: 't1' })
    expect(result.current.textTemplateId).toBeNull()
    act(() => result.current.setComposerText('again'))
    await act(async () => { result.current.sendMessage('c1') })
    expect(Object.keys(vi.mocked(api.post).mock.calls[1][1] as object)).toEqual(['direction', 'message_content'])
  })

  it('keeps the template id on a failed send and resets it when the thread changes', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { message: 'no' } } })
    let id = 'c1'
    const hook = renderHook(() => useConversationSend(id, vi.fn(), vi.fn()))
    act(() => { hook.result.current.setComposerText('hi'); hook.result.current.setTextTemplateId('t1') })
    await act(async () => { hook.result.current.sendMessage('c1') })
    expect(hook.result.current.textTemplateId).toBe('t1')
    id = 'c2'
    hook.rerender()
    expect(hook.result.current.textTemplateId).toBeNull()
  })

  it('marks the 202 stub when a template was sent, and prefers the server text when echoed', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 202, data: { outbox_id: 7 } })
    const { result, setMessages } = setup()
    act(() => { result.current.setComposerText('Hi {{first_name}}'); result.current.setTextTemplateId('t1') })
    await act(async () => { result.current.sendMessage('c1') })
    expect(vi.mocked(api.post).mock.calls[0][1]).toEqual({ direction: 'outbound', message_content: 'Hi {{first_name}}', text_template_id: 't1' })
    const stub = (setMessages.mock.calls[0][0] as (m: Record<string, unknown[]>) => Record<string, Array<Record<string, unknown>>>)({}).c1[0]
    expect(stub).toMatchObject({ message_content: 'Hi {{first_name}}', _viaTextTemplate: true })
    expect(result.current.textTemplateId).toBeNull()
    // A template send whose 202 echoes the rendered text: the stub carries the server text and no mark
    // (an exact twin will land, so the merge fallback is not needed).
    vi.mocked(api.post).mockResolvedValue({ status: 202, data: { outbox_id: 8, message_content: 'Hi Jan' } })
    act(() => { result.current.setComposerText('Hi {{first_name}}'); result.current.setTextTemplateId('t1') })
    await act(async () => { result.current.sendMessage('c1') })
    expect(vi.mocked(api.post).mock.calls[1][1]).toEqual({ direction: 'outbound', message_content: 'Hi {{first_name}}', text_template_id: 't1' })
    const stub2 = (setMessages.mock.calls[1][0] as (m: Record<string, unknown[]>) => Record<string, Array<Record<string, unknown>>>)({}).c1[0]
    expect(stub2).toMatchObject({ message_content: 'Hi Jan' })
    expect(stub2._viaTextTemplate).toBeUndefined()
  })

  it('fires one request when send runs twice synchronously', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 201, data: { id: 'm1' } })
    const { result } = setup()
    act(() => result.current.setComposerText('hi'))
    await act(async () => { result.current.sendMessage('c1'); result.current.sendMessage('c1') })
    expect(api.post).toHaveBeenCalledTimes(1)
  })

  it('adds a pending stub on a 202 outbox answer', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 202, data: { outbox_id: 9 } })
    const { result, setMessages } = setup()
    act(() => result.current.setComposerText('hi'))
    await act(async () => { result.current.sendMessage('c1') })
    const updater = setMessages.mock.calls[0][0] as (m: Record<string, unknown[]>) => Record<string, Array<Record<string, unknown>>>
    const next = updater({})
    expect(next.c1[0]).toMatchObject({ id: 'pending-9', _pendingOutboxId: 9, sent_at: null })
  })

  it('keeps the draft and sets sendError on a 409', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { message: 'window closed' } } })
    const { result } = setup()
    act(() => result.current.setComposerText('hi'))
    await act(async () => { result.current.sendMessage('c1') })
    expect(result.current.composerText).toBe('hi')
    expect(result.current.sendError).toBe('window closed')
  })

  it('sends nothing for an empty draft', async () => {
    const { result } = setup()
    await act(async () => { result.current.sendMessage('c1') })
    expect(api.post).not.toHaveBeenCalled()
  })
})

describe('useQueuedMessageRefresh', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('refetches a pending wa_web thread after the first backoff step', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'real', direction: 'outbound', sent_at: '2026-10-01T10:00:00Z' }] } })
    const setMessages = vi.fn()
    renderHook(() => useQueuedMessageRefresh('c1',
      [{ id: 'c1', primary_channel: 'wa_web' }],
      { c1: [{ id: 'pending-9', direction: 'outbound', sent_at: null, _pendingOutboxId: 9 } as never] },
      setMessages))
    expect(api.get).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(QUEUED_REFRESH_DELAYS_MS[0]) })
    expect(api.get).toHaveBeenCalledWith('/conversations/c1/messages')
  })
})
