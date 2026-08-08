/**
 * CandidateDrawerFooter — Danny 09-08: "aangemaakt op" already stood in the
 * footer, so the separate Herkomst card repeating it was a second truth. The
 * author joined that line here; the acquisition SOURCE deliberately did NOT (it
 * stays editable on the Profiel tab).
 *
 * These tests pin the seam, not a translated sentence: WHICH i18n key is used and
 * WITH WHICH interpolation values — so they hold both before and after the
 * `drawer.createdAtBy` key lands in the locale files, and a silently invented
 * "door onbekend" would fail them.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import CandidateDrawerFooter from './CandidateDrawerFooter'
import type { Candidate } from '@/types/candidate'

// t() renders "key|arg=value" so both the key and its values are assertable
// (mock-prefixed so Vitest hoists it alongside the vi.mock factory below).
const mockT = vi.fn((key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}|${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join('|')}` : key)
// initReactI18next is re-exported because lib/datetime pulls in the i18n runtime.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }), initReactI18next: { type: '3rdParty', init: () => {} } }))

// Tenant last-contact lookup: identity label resolver, no network in this suite.
vi.mock('@/lib/useLastContactTypes', () => ({ useLastContactTypes: () => ({ labelOf: (v: string) => v }) }))

const candidate = (overrides: Partial<Candidate> = {}): Candidate =>
  ({ id: 1, created: '2025-10-29T16:03:00', ...overrides } as unknown as Candidate)

describe('CandidateDrawerFooter · the creation stamp', () => {
  beforeEach(() => { mockT.mockClear() })

  it('states date AND author on one line when the record carries a creator', () => {
    render(<CandidateDrawerFooter c={candidate({ createdBy: { id: 7, name: 'Laura Yesway' } })} />)
    // DD-MM-YYYY, HH:mm via lib/datetime — never a hand-built date string (§14).
    expect(mockT).toHaveBeenCalledWith('drawer.createdAtBy', { date: '29-10-2025, 16:03', name: 'Laura Yesway' })
    expect(screen.getByText(/drawer\.createdAtBy\|date=29-10-2025, 16:03\|name=Laura Yesway/)).toBeInTheDocument()
  })

  it('falls back to the date-only line when the author is unknown — never "door onbekend"', () => {
    render(<CandidateDrawerFooter c={candidate({ createdBy: null })} />)
    expect(mockT).toHaveBeenCalledWith('drawer.createdAt', { date: '29-10-2025, 16:03' })
    expect(mockT).not.toHaveBeenCalledWith('drawer.createdAtBy', expect.anything())
    expect(screen.queryByText(/onbekend|unknown/i)).toBeNull()
  })

  it('omits the stamp entirely when there is no creation timestamp — no "Aangemaakt op —"', () => {
    render(<CandidateDrawerFooter c={{ id: 1 } as unknown as Candidate} />)
    expect(mockT).not.toHaveBeenCalledWith('drawer.createdAt', expect.anything())
    expect(mockT).not.toHaveBeenCalledWith('drawer.createdAtBy', expect.anything())
  })

  // §11: the source must have exactly ONE home (the Profiel tab's editable row);
  // a read-only copy down here would be the same duplication we just removed.
  it('does not repeat the acquisition source', () => {
    render(<CandidateDrawerFooter c={candidate({ source: 'werkzoeken', createdBy: { id: 7, name: 'Laura Yesway' } })} />)
    expect(screen.queryByText(/werkzoeken/)).toBeNull()
  })
})

describe('CandidateDrawerFooter · last contact (unchanged behaviour)', () => {
  beforeEach(() => { mockT.mockClear() })

  it('shows date · channel · author when a contact moment is registered', () => {
    render(<CandidateDrawerFooter c={candidate({ lastContactDate: '2026-07-24', lastContactType: 'Bellen', lastContactBy: 'Bente de Jong' })} />)
    expect(screen.getByText(/24-07-2026/)).toBeInTheDocument()
    expect(screen.getByText(/Bellen/)).toBeInTheDocument()
    expect(mockT).toHaveBeenCalledWith('drawer.byWho', { name: 'Bente de Jong' })
  })

  it('states "not registered" instead of a blank slot when nothing is known', () => {
    render(<CandidateDrawerFooter c={candidate()} />)
    expect(screen.getByText('drawer.notRegistered')).toBeInTheDocument()
  })
})
