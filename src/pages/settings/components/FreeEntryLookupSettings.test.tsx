/**
 * FreeEntryLookupSettings.test — proves the REQUEST shape of the strict-tightening
 * "gather missing" confirm action (§13). IDEMP-KEY-BODYLESS-1: the gather-missing
 * POST is body-less and click-triggered, so it must carry a fresh per-click
 * Idempotency-Key.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import api from '@/lib/api'
import i18n from '@/i18n'
import FreeEntryLookupSettings from './FreeEntryLookupSettings'

// Keep the real unwrap helper, stub only the default client's verbs.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { ...actual.default, get: vi.fn(), put: vi.fn(), post: vi.fn() } }
})

describe('FreeEntryLookupSettings · strict-tightening gather-missing', () => {
  it('POSTs gather-missing with a per-click Idempotency-Key after the mismatch confirm', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/functions/mismatches') {
        return Promise.resolve({ data: [{ name: 'Lasser', count: 2 }] })
      }
      return Promise.resolve({ data: { data: [] } })
    })
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    vi.mocked(api.put).mockResolvedValue({ data: {} })

    const user = userEvent.setup()
    render(
      <FreeEntryLookupSettings
        useLookup={() => ({ allowFreeEntry: true, invalidate: vi.fn() })}
        endpoint="/functions"
        i18nPrefix="functionsSettings"
        strictPreflight
      />,
    )

    // Turn the toggle OFF (tightening) — triggers the strict preflight GET.
    const toggle = screen.getByRole('switch')
    await user.click(toggle)

    // The mismatch confirm renders with its "gather missing" action button.
    const gatherButton = await screen.findByRole('button', {
      name: i18n.t('functionsSettings.gatherMissing', { ns: 'settings' }),
    })
    await user.click(gatherButton)

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/functions/gather-missing',
      undefined,
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }),
    ))
  })
})
