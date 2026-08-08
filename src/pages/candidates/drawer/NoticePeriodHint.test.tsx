/**
 * NoticePeriodHint — the derived availability date (Danny 2026-08-08, punt 9).
 *
 * Guards the two things that make this a SUGGESTION rather than an automatism:
 * it stays silent whenever the recruiter already recorded a date, and taking it
 * over is an explicit press that hands back exactly one ISO date.
 *
 * useDateFormat is stubbed (like every drawer test here) so `formatDate` is the
 * identity and the assertions read the raw ISO date instead of a locale string.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoticePeriodHint from './NoticePeriodHint'
import { deriveAvailableFrom } from './noticePeriod'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, locale: 'nl-NL' }) }))

const NOW = new Date(2026, 7, 9, 12, 0, 0) // 09-08-2026, local noon

describe('deriveAvailableFrom', () => {
  it('adds whole weeks to today and returns a yyyy-mm-dd date', () => {
    expect(deriveAvailableFrom(4, NOW)).toBe('2026-09-06')
    expect(deriveAvailableFrom(1, NOW)).toBe('2026-08-16')
  })

  it('crosses month and year boundaries correctly', () => {
    expect(deriveAvailableFrom(8, new Date(2026, 11, 28))).toBe('2027-02-22')
  })

  it('returns null for a missing, zero, negative or unparseable week count', () => {
    expect(deriveAvailableFrom(0, NOW)).toBeNull()
    expect(deriveAvailableFrom(-2, NOW)).toBeNull()
    expect(deriveAvailableFrom(NaN, NOW)).toBeNull()
  })

  // Local date parts, never a UTC round-trip: an evening "today" must not roll
  // back a day for a CET user (the classic off-by-one in derived dates).
  it('uses local date parts, so a late-evening clock still lands on the right day', () => {
    expect(deriveAvailableFrom(2, new Date(2026, 7, 9, 23, 30, 0))).toBe('2026-08-23')
  })
})

describe('NoticePeriodHint', () => {
  it('shows the derived date and an apply button when weeks are set and no date is recorded', () => {
    render(<NoticePeriodHint weeks={4} availableFrom={null} now={NOW} onApply={vi.fn()} />)
    expect(screen.getByText('preferences.noticePeriodDerivedHint')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'preferences.noticePeriodApply' })).toBeInTheDocument()
  })

  it('reads a week count the API serialised as a string (§10 tolerance)', () => {
    render(<NoticePeriodHint weeks="4" availableFrom="" now={NOW} onApply={vi.fn()} />)
    expect(screen.getByText('preferences.noticePeriodDerivedHint')).toBeInTheDocument()
  })

  it('renders nothing when an availability date already exists', () => {
    const { container } = render(<NoticePeriodHint weeks={4} availableFrom="2026-12-01" now={NOW} onApply={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing without a usable notice period', () => {
    const { container } = render(<NoticePeriodHint weeks="" availableFrom={null} now={NOW} onApply={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('hands back the derived ISO date on apply', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    render(<NoticePeriodHint weeks={6} availableFrom={null} now={NOW} onApply={onApply} />)
    await user.click(screen.getByRole('button', { name: 'preferences.noticePeriodApply' }))
    expect(onApply).toHaveBeenCalledWith('2026-09-20')
  })

  it('keeps the hint but drops the button when applying is not allowed (open draft)', () => {
    render(<NoticePeriodHint weeks={4} availableFrom={null} now={NOW} onApply={vi.fn()} canApply={false} />)
    expect(screen.getByText('preferences.noticePeriodDerivedHint')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  // No fake affordance (§3): without a persistence path there is no button at all.
  it('renders no button when no onApply is wired', () => {
    render(<NoticePeriodHint weeks={4} availableFrom={null} now={NOW} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
