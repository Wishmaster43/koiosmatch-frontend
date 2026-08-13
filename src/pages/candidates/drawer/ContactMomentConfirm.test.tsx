/**
 * B15-flow regression: a mailto: click in ProfileContactTab offers a small
 * confirm banner; confirming POSTs the contact moment and the drawer renders
 * ONLY the server's stamp — never a local "email + now" guess (the stamp must
 * stay monotonic).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@/i18n'
import ProfileContactTab from './ProfileContactTab'
import { useProfileRequiredKeys } from './useProfileRequiredKeys'
import type { Candidate } from '@/types/candidate'

vi.mock('./useProfileRequiredKeys', () => ({ useProfileRequiredKeys: vi.fn(() => []) }))

const postMock = vi.fn()
vi.mock('@/lib/api', () => ({ default: { post: (...args: unknown[]) => postMock(...args) } }))

describe('ProfileContactTab · B15-flow contact-moment confirm', () => {
  beforeEach(() => {
    vi.mocked(useProfileRequiredKeys).mockReturnValue([])
    postMock.mockReset()
  })

  const candidate = { id: 42, email: 'a@b.nl', phone: '', mobile: '', linkedin: '', phase: 'candidate' } as unknown as Candidate

  it('shows the confirm banner after a mailto click, POSTs the exact route+body on confirm, and renders the SERVER stamp', async () => {
    postMock.mockResolvedValue({ data: { data: { last_contact_at: '2026-08-13T10:00:00Z', last_contact_type: 'email' } } })
    const onContactMoment = vi.fn()
    render(<ProfileContactTab c={candidate} onContactMoment={onContactMoment} />)

    // The mailto link click opens the banner — it must never fire the request itself.
    fireEvent.click(screen.getByText('a@b.nl'))
    expect(postMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('contact-moment-confirm-email')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('contact-moment-confirm-email'))

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
    // Assert the REQUEST shape, not just that a callback fired (§13).
    expect(postMock).toHaveBeenCalledWith('/candidates/42/contact-moments', { channel: 'email' })

    // The banner closes and the SERVER's stamp — not a local guess — is handed up.
    await waitFor(() => expect(screen.queryByTestId('contact-moment-confirm-email')).toBeNull())
    expect(onContactMoment).toHaveBeenCalledWith({ lastContactAt: '2026-08-13T10:00:00Z', lastContactType: 'email' })
  })

  it('dismissing the banner never fires a request', () => {
    render(<ProfileContactTab c={candidate} />)
    fireEvent.click(screen.getByText('a@b.nl'))
    fireEvent.click(screen.getByText('Niet nu'))
    expect(screen.queryByTestId('contact-moment-confirm-email')).toBeNull()
    expect(postMock).not.toHaveBeenCalled()
  })
})
