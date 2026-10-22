/**
 * InterviewSettings (X-12) — asserts the REAL /settings request (§13: a mutation
 * test must prove the seam): the interview key loads with its tenant default and
 * saves on a single POST. Backend validates interview_rejection_mode against the
 * enum; the recruiter phone lives on the agent and the booking link left this
 * screen on Danny's row 53 (17-09).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
// vi.mocked() gives the mocked-module factory's plain vi.fn()s their real Mock typing at every call site.
const mockedApi = vi.mocked(api, true)
import InterviewSettings from './InterviewSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// Stored tenant blob read by the booking-link row (the real loader is bypassed).
const blobRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/useAllSettings')>('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => blobRef.current }
})

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

beforeEach(() => {
  vi.clearAllMocks()
  blobRef.current = {}
  mockedApi.get.mockResolvedValue({ data: {} })
  mockedApi.post.mockResolvedValue({ data: {} })
})

describe('InterviewSettings — load', () => {
  it('GETs /settings and renders the tenant default (proposal mode) with the booking-link row', async () => {
    render(<InterviewSettings />)
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/settings'))
    // Proposal mode is the default (shows as the trigger label).
    expect(await screen.findByText(t('interview.rejectionMode.options.proposal'))).toBeInTheDocument()
    // Danny 9a = A: the booking link lives on this screen again.
    expect(screen.getByLabelText(t('interview.bookingLink'))).toBeInTheDocument()
  })

  it('renders the stored rejection mode', async () => {
    mockedApi.get.mockResolvedValue({ data: { interview_rejection_mode: 'automatic' } })
    render(<InterviewSettings />)
    expect(await screen.findByText(t('interview.rejectionMode.options.automatic'))).toBeInTheDocument()
  })
})

describe('InterviewSettings — save', () => {
  // The recruiter phone lives on the AI agent (Danny 09-09, row 20); this screen posts the one tenant key.
  it('POSTs the interview key to /settings on save, never a booking_link', async () => {
    const user = userEvent.setup()
    render(<InterviewSettings />)

    // Change rejection mode to automatic.
    const modeButton = await screen.findByText(t('interview.rejectionMode.options.proposal'))
    await user.click(modeButton)
    await user.click(screen.getByText(t('interview.rejectionMode.options.automatic')))

    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/settings', {
      interview_rejection_mode: 'automatic',
    }))
  })
})

describe('InterviewSettings — errors', () => {
  it('still attempts the POST when the backend answers 422 on the rejection mode', async () => {
    mockedApi.post.mockRejectedValue({
      response: { status: 422, data: { message: 'Invalid mode.', errors: { interview_rejection_mode: ['The selected mode is invalid.'] } } },
    })
    const user = userEvent.setup()
    render(<InterviewSettings />)

    const modeButton = await screen.findByText(t('interview.rejectionMode.options.proposal'))
    await user.click(modeButton)
    await user.click(screen.getByText(t('interview.rejectionMode.options.automatic')))
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    // The useSettingsForm hook handles error display; we verify the POST was attempted.
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalled())
  })

  it('renders the error notice and disables Save when GET /settings fails', async () => {
    mockedApi.get.mockRejectedValue(new Error('network down'))
    render(<InterviewSettings />)

    expect(await screen.findByText(t('common.loadError'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('common.save') })).toBeDisabled()
  })
})

describe('InterviewSettings — booking link', () => {
  it('POSTs exactly { booking_link } on blur for a valid URL', async () => {
    render(<InterviewSettings />)
    const input = await screen.findByLabelText(t('interview.bookingLink'))
    fireEvent.change(input, { target: { value: 'https://boeken.example.nl/intake' } })
    fireEvent.blur(input)
    expect(mockedApi.post).toHaveBeenCalledWith('/settings', { booking_link: 'https://boeken.example.nl/intake' })
  })

  it('refuses a non-URL with a hint and no request', async () => {
    render(<InterviewSettings />)
    const input = await screen.findByLabelText(t('interview.bookingLink'))
    fireEvent.change(input, { target: { value: 'not a url' } })
    fireEvent.blur(input)
    expect(screen.getByText(t('interview.bookingLinkInvalid'))).toBeInTheDocument()
    expect(mockedApi.post).not.toHaveBeenCalled()
  })

  it('reverts the draft when the save is refused', async () => {
    blobRef.current = { booking_link: 'https://a.example.nl/x' }
    mockedApi.post.mockRejectedValueOnce(new Error('422'))
    render(<InterviewSettings />)
    const input = await screen.findByLabelText(t('interview.bookingLink'))
    fireEvent.change(input, { target: { value: 'https://b.example.nl/y' } })
    fireEvent.blur(input)
    await waitFor(() => expect(input).toHaveValue('https://a.example.nl/x'))
  })
})
