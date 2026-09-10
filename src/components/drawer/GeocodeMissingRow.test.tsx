/**
 * GeocodeMissingRow — behaviour: the message renders, and the endpoint/
 * permission/disabled props reach GeocodeButton unchanged (the request itself
 * is GeocodeButton's own contract, already covered by its own test).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import GeocodeMissingRow from './GeocodeMissingRow'

const mockUseAuth = vi.fn()
const mockPost = vi.fn()

vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/lib/api', () => ({
  default: { post: (...args: unknown[]) => mockPost(...args) },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data ?? r?.data,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({ hasPermission: () => true })
  mockPost.mockResolvedValue({ status: 202, data: {} })
})

describe('GeocodeMissingRow', () => {
  it('renders the resolved message and a geocode trigger', () => {
    render(<GeocodeMissingRow message="No location known" endpoint="/candidates/1/geocode" permission="candidates.update" />)
    expect(screen.getByText('No location known')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('hides the trigger entirely when the caller lacks the permission (GeocodeButton\'s own gate)', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(<GeocodeMissingRow message="No location known" endpoint="/candidates/1/geocode" permission="candidates.update" />)
    expect(screen.getByText('No location known')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('disables the trigger when disabled is set (e.g. no address on the record)', () => {
    render(<GeocodeMissingRow message="No location known" endpoint="/candidates/1/geocode" permission="candidates.update" disabled />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('fires the given endpoint on click, unaffected by the message/wrapper', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<GeocodeMissingRow message="No location known" endpoint="/vacancies/9/geocode" permission="vacancies.update" />)
    await user.click(screen.getByRole('button'))
    expect(mockPost).toHaveBeenCalledWith('/vacancies/9/geocode')
  })
})
