/**
 * useAgentSessionControl (CMFE-MEET-1) — asserts the REQUEST (§13): pause and
 * resume hit their exact routes, the caller's refetch runs only on success, and
 * a 409 surfaces the server's own message instead of a generic toast.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentSessionControl } from './useAgentSessionControl'

const { postMock, notifyErrorMock } = vi.hoisted(() => ({ postMock: vi.fn(), notifyErrorMock: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: { post: postMock } }))
vi.mock('@/lib/notify', () => ({ notifyError: notifyErrorMock }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }))

describe('useAgentSessionControl', () => {
  beforeEach(() => { postMock.mockReset(); notifyErrorMock.mockReset() })

  it('pause POSTs the pause route, then refetches and resolves true', async () => {
    postMock.mockResolvedValue({ data: { data: { id: 'c1', agent_session_status: 'paused' } } })
    const onChanged = vi.fn()
    const { result } = renderHook(() => useAgentSessionControl(onChanged, 'whatsapp:conversations.agentControlFailed'))
    let ok = false
    await act(async () => { ok = await result.current.run('c1', 'pause') })
    expect(postMock).toHaveBeenCalledWith('/conversations/c1/agent-session/pause', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(ok).toBe(true)
    expect(result.current.busy).toBeNull()
  })

  it('resume POSTs the resume route', async () => {
    postMock.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useAgentSessionControl(vi.fn(), 'test:failed'))
    await act(async () => { await result.current.run('c1', 'resume') })
    expect(postMock).toHaveBeenCalledWith('/conversations/c1/agent-session/resume', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
  })

  it('ONIX N-007: two run calls in one tick POST once, the second resolves false', async () => {
    let resolvePost: (v: unknown) => void = () => {}
    postMock.mockImplementation(() => new Promise(resolve => { resolvePost = resolve }))
    const onChanged = vi.fn()
    const { result } = renderHook(() => useAgentSessionControl(onChanged, 'test:failed'))
    let first: Promise<boolean> = Promise.resolve(false)
    let second: Promise<boolean> = Promise.resolve(false)
    act(() => {
      first = result.current.run('c1', 'pause')
      second = result.current.run('c1', 'pause')
    })
    await act(async () => { resolvePost({ data: {} }) })
    expect(await second).toBe(false)
    await first
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(postMock).toHaveBeenCalledWith('/conversations/c1/agent-session/pause', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('a 409 surfaces the server message, skips the refetch and resolves false', async () => {
    postMock.mockRejectedValue({ response: { status: 409, data: { message: 'Geen actief interview voor dit gesprek.' } } })
    const onChanged = vi.fn()
    const { result } = renderHook(() => useAgentSessionControl(onChanged, 'test:failed'))
    let ok = true
    await act(async () => { ok = await result.current.run('c1', 'pause') })
    expect(ok).toBe(false)
    expect(onChanged).not.toHaveBeenCalled()
    expect(notifyErrorMock).toHaveBeenCalledWith('Geen actief interview voor dit gesprek.')
  })
})
