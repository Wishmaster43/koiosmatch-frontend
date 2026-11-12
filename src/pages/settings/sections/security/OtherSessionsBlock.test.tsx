/**
 * OtherSessionsBlock — the button POSTs /auth/sessions/logout-others without a body
 * and maps 2xx, 429 and other failures to their own notice keys; the button is disabled while in flight.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OtherSessionsBlock from './OtherSessionsBlock'
import api from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'

// Key-echo translations.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))
vi.mock('@/lib/api', () => ({ default: { post: vi.fn(), get: vi.fn().mockRejectedValue(new Error('offline')) } }))
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

describe('OtherSessionsBlock', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('POSTs the logout-others route with no body and shows the success key', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    render(<OtherSessionsBlock />)
    await userEvent.setup().click(screen.getByText('security.otherSessionsButton'))
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('security.otherSessionsDone'))
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.post).mock.calls[0]).toEqual(['/auth/sessions/logout-others'])
  })

  it('shows the throttled key on a 429', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 429 } })
    render(<OtherSessionsBlock />)
    await userEvent.setup().click(screen.getByText('security.otherSessionsButton'))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('security.otherSessionsThrottled'))
    expect(notifySuccess).not.toHaveBeenCalled()
  })

  it('shows the generic failure key on another error', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 500 } })
    render(<OtherSessionsBlock />)
    await userEvent.setup().click(screen.getByText('security.otherSessionsButton'))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('security.otherSessionsFailed'))
  })

  it('disables the button and shows the working label while the request is in flight', async () => {
    let settle: (value: { data: unknown }) => void = () => {}
    vi.mocked(api.post).mockReturnValue(new Promise(resolve => { settle = resolve }) as ReturnType<typeof api.post>)
    render(<OtherSessionsBlock />)
    await userEvent.setup().click(screen.getByText('security.otherSessionsButton'))
    expect(screen.getByText('security.working').closest('button')).toBeDisabled()
    settle({ data: {} })
    await waitFor(() => expect(screen.getByText('security.otherSessionsButton').closest('button')).toBeEnabled())
  })
})
