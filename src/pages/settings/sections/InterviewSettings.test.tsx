/**
 * InterviewSettings (X-12) — asserts the REAL /settings request (§13: a mutation
 * test must prove the seam): the interview key loads with its tenant default and
 * is read-only (I-005, nothing posted). The recruiter phone lives on the agent and the booking link left this
 * screen on Danny's row 53 (17-09).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
  it('renders the read-only proposal line with the booking-link row', async () => {
    render(<InterviewSettings />)
    // Proposal mode is the default (shows as the trigger label).
    expect(await screen.findByText(t('interview.rejectionMode.options.proposal'))).toBeInTheDocument()
    // Danny 9a = A: the booking link lives on this screen again.
    expect(screen.getByLabelText(t('interview.bookingLink'))).toBeInTheDocument()
  })

  it('renders the read-only proposal line whatever the stored mode, and offers no automatic option', async () => {
    mockedApi.get.mockResolvedValue({ data: { interview_rejection_mode: 'automatic' } })
    render(<InterviewSettings />)
    expect(await screen.findByText(t('interview.rejectionMode.options.proposal'))).toBeInTheDocument()
    expect(screen.queryByText(/automati/i)).not.toBeInTheDocument()
  })
})

describe('InterviewSettings — read-only mode', () => {
  // ONIX I-005: no control, no Save button, and never a POST of the mode.
  it('posts nothing on render and shows no Save button or combobox', async () => {
    render(<InterviewSettings />)
    await screen.findByText(t('interview.rejectionMode.options.proposal'))
    expect(mockedApi.post).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: t('common.save') })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
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
