/**
 * useKoiosChat — KOIOS-MEMORY-1: every turn carries the earlier turns as text history and
 * the records the previous answer named as context, so a follow-up ("hem") has its anchor.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKoiosChat, historyOf, carriedRefsOf, KOIOS_HISTORY_TURNS } from './useKoiosChat'
import type { KoiosChatMessage } from '@/types/koios'

const mockSendChat = vi.fn()
vi.mock('./koiosApi', () => ({ sendChat: (...args: unknown[]) => mockSendChat(...args) }))

const niels = { type: 'candidate', id: 'c1', label: 'Niels Groen' }

beforeEach(() => { mockSendChat.mockReset() })

describe('useKoiosChat · memory', () => {
  it('sends the earlier turns as history and the previous answer\'s records as context', async () => {
    mockSendChat.mockResolvedValueOnce({ answer: 'Dit nummer hoort bij Niels Groen.', steps: [{ refs: [niels] }] })
    mockSendChat.mockResolvedValueOnce({ answer: 'Welk bericht wil je sturen?', steps: [] })
    const { result } = renderHook(() => useKoiosChat())
    await act(async () => { await result.current.send('welke kandidaat hoort bij +31618659379?') })
    // First turn: no history yet, no carried records.
    expect(mockSendChat.mock.calls[0][6]).toBeUndefined()
    expect(mockSendChat.mock.calls[0][2]).toBeUndefined()
    await act(async () => { await result.current.send('kan je hem een bericht sturen?') })
    const [message, , context, , , , history] = mockSendChat.mock.calls[1]
    expect(message).toBe('kan je hem een bericht sturen?')
    expect(history).toEqual([
      { role: 'user', content: 'welke kandidaat hoort bij +31618659379?' },
      { role: 'assistant', content: 'Dit nummer hoort bij Niels Groen.' },
    ])
    expect(context).toEqual([niels])
  })

  it('keeps explicit @-mentions first and never duplicates a carried record', async () => {
    mockSendChat.mockResolvedValueOnce({ answer: 'ok', steps: [{ refs: [niels] }] })
    mockSendChat.mockResolvedValueOnce({ answer: 'ok', steps: [] })
    const { result } = renderHook(() => useKoiosChat())
    await act(async () => { await result.current.send('eerste') })
    const vacancy = { type: 'vacancy', id: 'v1', label: 'Verzorgende IG' }
    await act(async () => { await result.current.send('tweede', [vacancy, niels]) })
    expect(mockSendChat.mock.calls[1][2]).toEqual([vacancy, niels])
  })

  it('historyOf keeps text turns only and the last eight; carriedRefsOf drops a long list', () => {
    const thread: KoiosChatMessage[] = [{ role: 'assistant', kind: 'welcome' }]
    for (let i = 0; i < 6; i++) thread.push({ role: 'user', content: `u${i}` }, { role: 'assistant', answer: `a${i}` })
    thread.push({ role: 'assistant', kind: 'error' })
    const history = historyOf(thread)
    expect(history).toHaveLength(KOIOS_HISTORY_TURNS)
    expect(history[0]).toEqual({ role: 'user', content: 'u2' })
    expect(history[history.length - 1]).toEqual({ role: 'assistant', content: 'a5' })
    const many = Array.from({ length: 13 }, (_, i) => ({ type: 'candidate', id: `c${i}`, label: `Niels ${i}` }))
    expect(carriedRefsOf([{ role: 'assistant', answer: 'x', steps: [{ refs: many }] }])).toEqual([])
    expect(carriedRefsOf([{ role: 'assistant', answer: 'x', steps: [{ refs: [niels] }, { refs: [niels] }] }])).toEqual([niels])
  })
})
