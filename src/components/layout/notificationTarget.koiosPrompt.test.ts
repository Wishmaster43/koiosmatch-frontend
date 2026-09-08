/**
 * koiosPromptOf — X-31: extract the ready-made Koios prompt from a notification
 * row, or null when missing/empty.
 */
import { describe, it, expect } from 'vitest'
import { koiosPromptOf } from './notificationTarget'
import type { AppNotification } from '@/hooks/useNotifications'

describe('koiosPromptOf', () => {
  it('returns the prompt string when koios_action carries a non-empty prompt', () => {
    const n = { id: 1, koios_action: { prompt: 'Stel een vraag over deze match' } } as unknown as AppNotification
    expect(koiosPromptOf(n)).toBe('Stel een vraag over deze match')
  })

  it('trims whitespace from the prompt', () => {
    const n = { id: 2, koios_action: { prompt: '  Vraag stellen  ' } } as unknown as AppNotification
    expect(koiosPromptOf(n)).toBe('Vraag stellen')
  })

  it('returns null when koios_action is null', () => {
    const n = { id: 3, koios_action: null } as unknown as AppNotification
    expect(koiosPromptOf(n)).toBeNull()
  })

  it('returns null when koios_action is missing', () => {
    const n = { id: 4 } as unknown as AppNotification
    expect(koiosPromptOf(n)).toBeNull()
  })

  it('returns null when the prompt is an empty string', () => {
    const n = { id: 5, koios_action: { prompt: '' } } as unknown as AppNotification
    expect(koiosPromptOf(n)).toBeNull()
  })

  it('returns null when the prompt is only whitespace', () => {
    const n = { id: 6, koios_action: { prompt: '   ' } } as unknown as AppNotification
    expect(koiosPromptOf(n)).toBeNull()
  })
})
