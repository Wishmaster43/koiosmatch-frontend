/**
 * GeocodeButton (GEO-REGEOCODE-1) — permission gate (hidden, never disabled), the
 * real POST to the caller-given per-id endpoint on click, and the honest "started"
 * (never "done") toast on the queued 202 (§13: assert the REQUEST, not just a
 * fired callback).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GeocodeButton from './GeocodeButton'

const mockUseAuth = vi.fn()
const mockPost = vi.fn()
const mockNotifySuccess = vi.fn()

vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/lib/api', () => ({ default: { post: (...args: unknown[]) => mockPost(...args) } }))
vi.mock('@/lib/notify', () => ({ notifySuccess: (...a: unknown[]) => mockNotifySuccess(...a) }))

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({ hasPermission: () => true })
  mockPost.mockResolvedValue({ status: 202, data: {} })
})

describe('GeocodeButton · permission gate', () => {
  it('renders nothing when the caller lacks the given permission (hidden, not disabled)', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(<GeocodeButton endpoint="/candidates/1/geocode" permission="candidates.update" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders when the permission is granted', () => {
    render(<GeocodeButton endpoint="/candidates/1/geocode" permission="candidates.update" />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})

describe('GeocodeButton · click fires the exact per-id POST', () => {
  it('POSTs the candidate endpoint with no body on click', async () => {
    const user = userEvent.setup()
    render(<GeocodeButton endpoint="/candidates/42/geocode" permission="candidates.update" />)
    await user.click(screen.getByRole('button'))
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/candidates/42/geocode')
  })

  it('POSTs a customer endpoint verbatim (same component, different caller)', async () => {
    const user = userEvent.setup()
    render(<GeocodeButton endpoint="/customers/7/geocode" permission="customers.update" />)
    await user.click(screen.getByRole('button'))
    expect(mockPost).toHaveBeenCalledWith('/customers/7/geocode')
  })

  it('shows the "started" toast, never a "done" toast, after the queued 202', async () => {
    const user = userEvent.setup()
    render(<GeocodeButton endpoint="/vacancies/9/geocode" permission="vacancies.update" />)
    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith('geocode.started'))
  })

  it('never calls the API on mount — only on an explicit click', () => {
    render(<GeocodeButton endpoint="/candidates/1/geocode" permission="candidates.update" />)
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('GeocodeButton · disabled prop (caller-set, e.g. no address)', () => {
  it('renders disabled and never fires the POST on click when disabled', async () => {
    const user = userEvent.setup()
    render(<GeocodeButton endpoint="/candidates/1/geocode" permission="candidates.update" disabled />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    await user.click(btn)
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('GeocodeButton · failure stays quiet (api.ts already surfaces the dev toast)', () => {
  it('does not throw and stops the spinner when the POST rejects', async () => {
    mockPost.mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    render(<GeocodeButton endpoint="/locations/3/geocode" permission="settings.update" />)
    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled())
    expect(mockNotifySuccess).not.toHaveBeenCalled()
  })
})
