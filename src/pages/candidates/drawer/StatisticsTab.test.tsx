/**
 * StatisticsTab — CREATED-BY-SOURCE-1 (Danny: "wil ik ook zien aangemaakt door
 * wie en de bron"): the overview card gains two rows, each falling back to an
 * italic muted em-dash (§4) when the value is unset (legacy rows).
 * LAST-CONTACT-LIVE-1: the last-contact row wires the real last_contact_at/
 * _type/_by stamps — DD-MM-YYYY date, "door {name}" when a stamped user is
 * known, and the same honest em-dash when the candidate was never contacted.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatisticsTab from './StatisticsTab'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v }) }))
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ statusMeta: () => ({ label: '' }) }) }))
vi.mock('@/lib/useLastContactTypes', () => ({ useLastContactTypes: () => ({ labelOf: (v: string) => v }) }))
// Mirrors RetentionConsentBlock.test.tsx's pattern: interpolate only the option
// this suite asserts on ("name" for drawer.byWho), key-fallback for the rest —
// real i18next has no instance in this test env, so t() would otherwise drop opts.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o && 'name' in o ? `${k}|${o.name}` : k),
  }),
}))

const baseCandidate = (overrides: Partial<Candidate> = {}): Candidate =>
  ({ id: 1, matches: [], applications: [], branches: [], ...overrides } as unknown as Candidate)

describe('StatisticsTab · createdBy / source rows', () => {
  it('shows the creator name and the acquisition source when present', () => {
    render(<StatisticsTab c={baseCandidate({ createdBy: { id: 7, name: 'Bente de Jong' }, source: 'indeed' })} />)
    expect(screen.getByText('Bente de Jong')).toBeInTheDocument()
    expect(screen.getByText('indeed')).toBeInTheDocument()
  })

  it('renders an italic em-dash for a legacy row without a creator/source', () => {
    render(<StatisticsTab c={baseCandidate({ createdBy: null, source: null })} />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
    dashes.forEach(el => expect(el).toHaveStyle({ fontStyle: 'italic' }))
  })
})

describe('StatisticsTab · last-contact row (LAST-CONTACT-LIVE-1)', () => {
  it('shows the stamped date and the "door {name}" attribution when both landed', () => {
    render(<StatisticsTab c={baseCandidate({ lastContactDate: '2026-08-01', lastContactType: 'phone', lastContactBy: 'Bente de Jong' })} />)
    // The date + attribution render as sibling text nodes inside one row value
    // (a JSX fragment) — match on the row's full text, not an isolated node.
    expect(screen.getByText(/2026-08-01.*drawer\.byWho\|Bente de Jong/)).toBeInTheDocument()
  })

  it('shows the date without an attribution when no user is stamped', () => {
    render(<StatisticsTab c={baseCandidate({ lastContactDate: '2026-08-01', lastContactType: null, lastContactBy: null })} />)
    expect(screen.getByText('2026-08-01')).toBeInTheDocument()
    expect(screen.queryByText(/drawer\.byWho/)).not.toBeInTheDocument()
  })

  it('renders an honest italic em-dash when the candidate was never contacted', () => {
    render(<StatisticsTab c={baseCandidate({ lastContactDate: null, lastContactType: null, lastContactBy: null })} />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2) // last-contact row + contact-type row
    dashes.forEach(el => expect(el).toHaveStyle({ fontStyle: 'italic' }))
  })
})
