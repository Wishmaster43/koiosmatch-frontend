/**
 * CandidateDrawerFooter — Danny 09-08 "ik mis de bron": source, created-by and
 * created-on used to be split across two places — a stray row in the
 * "Persoonlijk" card and this footer's creation stamp — and that split is
 * exactly what made the source unfindable (it read as a property of the
 * PERSON in Persoonlijk, while it describes the DOSSIER). All three now live
 * together in CandidateOriginCard ("Herkomst") on the Profiel tab, and this
 * footer strip no longer renders any creation info at all — only last contact.
 *
 * These tests pin the seam, not a translated sentence: WHICH i18n key is used and
 * WITH WHICH interpolation values — so they hold both before and after a locale
 * wording change, and a silently invented "door onbekend" would fail them.
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

describe('CandidateDrawerFooter · no creation stamp (moved to CandidateOriginCard)', () => {
  beforeEach(() => { mockT.mockClear() })

  // Regression guard, not a duplication test: source, author and timestamp are
  // ALL present on the record, yet none of them may surface here — that exact
  // split (stamp in the footer, source on the Profiel tab) is the bug that made
  // the source unfindable in the first place (§11 — one place per value).
  it('never renders creation info — source, author and timestamp all moved to CandidateOriginCard', () => {
    render(<CandidateDrawerFooter c={candidate({ createdBy: { id: 7, name: 'Laura Yesway' }, source: 'werkzoeken' })} />)
    expect(mockT).not.toHaveBeenCalledWith('drawer.createdAt', expect.anything())
    expect(mockT).not.toHaveBeenCalledWith('drawer.createdAtBy', expect.anything())
    expect(screen.queryByText(/Laura Yesway/)).toBeNull()
    expect(screen.queryByText(/werkzoeken/)).toBeNull()
    expect(screen.queryByText(/29-10-2025/)).toBeNull()
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
