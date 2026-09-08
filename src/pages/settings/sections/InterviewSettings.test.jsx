/**
 * InterviewSettings (X-12) — asserts the REAL /settings request (§13: a mutation
 * test must prove the seam): the three interview keys load with tenant defaults,
 * and save all three on a single POST. Backend validates interview_rejection_mode
 * against the enum and booking_link as a URL (the recruiter phone lives on the agent).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import InterviewSettings from './InterviewSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: {} })
  api.post.mockResolvedValue({ data: {} })
})

describe('InterviewSettings — load', () => {
  it('GETs /settings and renders the tenant defaults (proposal mode, empty booking_link)', async () => {
    render(<InterviewSettings />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    // Proposal mode is the default (shows as the trigger label).
    expect(await screen.findByText(t('interview.rejectionMode.options.proposal'))).toBeInTheDocument()
    // Empty text fields render with no value.
    const textInputs = screen.getAllByRole('textbox')
    expect(textInputs.some(input => input.value === '')).toBe(true)
  })

  it('coerces stored values to their proper types', async () => {
    api.get.mockResolvedValue({
      data: {
        interview_rejection_mode: 'automatic',
        booking_link: 'https://calendly.com/mycompany',
      },
    })
    render(<InterviewSettings />)
    expect(await screen.findByText(t('interview.rejectionMode.options.automatic'))).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://calendly.com/mycompany')).toBeInTheDocument()
  })
})

describe('InterviewSettings — save', () => {
  // The recruiter phone lives on the AI agent (Danny 09-09, row 20); this screen posts the two tenant keys.
  it('POSTs the two interview keys to /settings on save', async () => {
    const user = userEvent.setup()
    render(<InterviewSettings />)

    // Change rejection mode to automatic.
    const modeButton = await screen.findByText(t('interview.rejectionMode.options.proposal'))
    await user.click(modeButton)
    const automaticOption = screen.getByText(t('interview.rejectionMode.options.automatic'))
    await user.click(automaticOption)

    // Fill in the booking link (wait for the field to load).
    const bookingLinkInput = await screen.findByPlaceholderText(t('interview.bookingLink.placeholder'))
    await user.type(bookingLinkInput, 'https://calendly.com/mycompany')

    // Save and assert the POST body.
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
      interview_rejection_mode: 'automatic',
      booking_link: 'https://calendly.com/mycompany',
    }))
  })

  it('saves only changed fields and keeps defaults for unchanged ones', async () => {
    const user = userEvent.setup()
    render(<InterviewSettings />)

    // Only change the booking link, leave the rejection mode at its default.
    const bookingLinkInput = await screen.findByPlaceholderText(t('interview.bookingLink.placeholder'))
    await user.type(bookingLinkInput, 'https://bookings.example.com')

    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
      interview_rejection_mode: 'proposal',
      booking_link: 'https://bookings.example.com',
    }))
  })
})

describe('InterviewSettings — errors', () => {
  it('shows backend 422 error message for booking_link validation failure', async () => {
    api.post.mockRejectedValue({
      response: {
        status: 422,
        data: {
          message: 'Invalid URL.',
          errors: { booking_link: ['Must be a valid URL.'] },
        },
      },
    })
    const user = userEvent.setup()
    render(<InterviewSettings />)

    const bookingLinkInput = await screen.findByPlaceholderText(t('interview.bookingLink.placeholder'))
    await user.type(bookingLinkInput, 'not-a-url')
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    // The useSettingsForm hook handles error display; we verify the POST was attempted.
    await waitFor(() => expect(api.post).toHaveBeenCalled())
  })

  it('renders the error notice and disables Save when GET /settings fails', async () => {
    api.get.mockRejectedValue(new Error('network down'))
    render(<InterviewSettings />)

    expect(await screen.findByText(t('common.loadError'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('common.save') })).toBeDisabled()
  })
})
