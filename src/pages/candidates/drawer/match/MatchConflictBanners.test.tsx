/**
 * MatchConflictBanners — the hours-sum escalation on point 6's overlap banner
 * (Danny, on top of MATCH-LIST-HOURS-1): both branches covered — plain
 * date-only wording stays the default, and the stronger combined-hours wording
 * only appears once BOTH sides carry hours and the sum exceeds a full-time
 * week. Param-echoing i18n mock (repo precedent, MergeCustomerModal.test.tsx)
 * proves both WHICH key renders and the exact values passed to it, without
 * depending on the real (not-yet-updated) locale JSON.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MatchConflictBanners from './MatchConflictBanners'
import type { ExistingMatchRow } from './matchConflicts'

// Only override useTranslation (importOriginal keeps initReactI18next etc. real —
// lib/formatters' useNumberFormat pulls in lib/datetime, which needs those intact,
// DATETIME-IMPORT-LES). Locale unset under this mock (i18n?.language ?? '') —
// useLocale falls back to 'nl-NL', so nl formatting ("," decimal separator) is
// what these tests exercise.
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) }),
  }
})

const formatDate = (v: string) => v // identity — only the key/param selection is under test here

// A minimal overlapping-match fixture — only the fields the banner reads.
const row = (overrides: Partial<ExistingMatchRow> = {}): ExistingMatchRow => ({
  id: 'm-1', vacancyTitle: 'Verzorgende IG', client: 'Zorggroep A',
  customerId: 'cust-1', customerLocationId: null, customerDepartmentId: null,
  status: 'open', startDate: '2026-05-01', endDate: '2026-08-01', hoursPerWeek: null,
  ...overrides,
})

describe('MatchConflictBanners · hours-sum escalation', () => {
  it('renders nothing when there is no duplicate and no overlap', () => {
    const { container } = render(<MatchConflictBanners duplicateMatch={null} overlappingMatches={[]} formatDate={formatDate} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('keeps the plain date-only wording when the row has no hours_per_week at all (offered-iff-read)', () => {
    render(<MatchConflictBanners duplicateMatch={null} overlappingMatches={[row({ hoursPerWeek: null })]} formatDate={formatDate} draftHours={24} />)
    expect(screen.getByText(/placement\.overlapWarning:/)).toBeInTheDocument()
    expect(screen.queryByText(/placement\.overlapWarningHours/)).not.toBeInTheDocument()
  })

  it('keeps the plain date-only wording when the DRAFT has no hours yet, even if the row does', () => {
    render(<MatchConflictBanners duplicateMatch={null} overlappingMatches={[row({ hoursPerWeek: 30 })]} formatDate={formatDate} />)
    expect(screen.getByText(/placement\.overlapWarning:/)).toBeInTheDocument()
    expect(screen.queryByText(/placement\.overlapWarningHours/)).not.toBeInTheDocument()
  })

  it('keeps the plain date-only wording when both carry hours but the sum stays at/under a full-time week', () => {
    render(<MatchConflictBanners duplicateMatch={null} overlappingMatches={[row({ hoursPerWeek: 20 })]} formatDate={formatDate} draftHours={20} />)
    expect(screen.getByText(/placement\.overlapWarning:/)).toBeInTheDocument()
    expect(screen.queryByText(/placement\.overlapWarningHours/)).not.toBeInTheDocument()
  })

  it('escalates to the combined-hours wording once both sides carry hours and the sum exceeds a full-time week', () => {
    render(<MatchConflictBanners duplicateMatch={null} overlappingMatches={[row({ hoursPerWeek: 20 })]} formatDate={formatDate} draftHours={24} />)
    const banner = screen.getByText(/placement\.overlapWarningHours:/)
    expect(banner).toBeInTheDocument()
    // The combined sum (44) reaches the banner, not either side's individual hours.
    expect(banner.textContent).toContain('"hours":"44"')
    expect(screen.queryByText(/placement\.overlapWarning:/)).not.toBeInTheDocument()
  })

  it('formats a fractional hours sum with the locale decimal separator (GETALLEN-1), never a raw float', () => {
    render(<MatchConflictBanners duplicateMatch={null} overlappingMatches={[row({ hoursPerWeek: 20 })]} formatDate={formatDate} draftHours={20.5} />)
    const banner = screen.getByText(/placement\.overlapWarningHours:/)
    // nl-NL fallback (this mock's i18n has no `language`): comma decimal, not "40.5".
    expect(banner.textContent).toContain('"hours":"40,5"')
  })

  it('evaluates each overlapping row independently against the same draft hours', () => {
    render(
      <MatchConflictBanners
        duplicateMatch={null}
        overlappingMatches={[row({ id: 'm-1', hoursPerWeek: 20 }), row({ id: 'm-2', hoursPerWeek: 4 })]}
        formatDate={formatDate}
        draftHours={24}
      />
    )
    // m-1: 24+20=44 > 40 → escalated. m-2: 24+4=28 ≤ 40 → stays mild.
    expect(screen.getAllByText(/placement\.overlapWarningHours:/)).toHaveLength(1)
    expect(screen.getAllByText(/placement\.overlapWarning:/)).toHaveLength(1)
  })
})
