/**
 * MatchesTab (customer drawer) — mirrors candidates/drawer/MatchesTab.test.tsx's
 * own coverage: empty state, the real-anchor "Open match" affordance, and the
 * four explicit UI states (§3). The one behavioural difference from the
 * candidate tab is proven here too: this tab is READ-ONLY — no pencil/onEdit,
 * ever (a match is opened/edited in its own drawer, never from this list).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
// Side-effect import: the real i18next instance, so useTranslation resolves
// actual copy (mirrors VacanciesTab.test.tsx) instead of warning/returning keys.
import '@/i18n'
import i18n from '@/i18n'
import MatchesTab from './MatchesTab'
import type { CustomerMatchRow } from '../hooks/useCustomerDrawerData'

// The lookup's own fetch/resolution is out of scope here (mirrors the candidate
// test) — a controlled meta resolver proves the card prefers it over the raw row.
// eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
const metaOf = vi.fn((v?: string) => (v === 'open' ? { value: 'open', label: 'Open (lookup)', color: '#123456', is_closed: false } : undefined))
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => ({ statuses: [], metaOf }) }))

// The hook that fires GET /matches?customer_id= is proven separately
// (useCustomerMatches.test.ts, request-shape) — this file stubs it so the
// component test stays about rendering, not the network seam.
const mockUseCustomerMatches = vi.fn()
vi.mock('../hooks/useCustomerDrawerData', () => ({ useCustomerMatches: () => mockUseCustomerMatches() }))

const row = (over: Partial<CustomerMatchRow> = {}): CustomerMatchRow => ({
  id: 'm-1', referenceNumber: 'M-1', candidate: 'Jane Doe', initials: 'JD',
  vacancy: 'Verpleegkundige', client: 'Yesway', candidateId: 'cand-1', vacancyId: 'vac-1', clientId: 'cust-1',
  score: 82, stage: '', status: '', stageColor: '', owner: '', ownerId: null, ownerInitials: '', ownerColor: null,
  date: '', approval_status: '', approval_rejected_reason: '', customFieldValues: {},
  helloflexLink: null, shiftmanagerLink: null, archived: false, archivedAt: null,
  contractType: null, contractStatus: null,
  ...over,
})

const ct = (key: string) => i18n.t(key, { ns: 'candidates' })

describe('CustomerDrawer · MatchesTab', () => {
  it('shows loading, then the empty state with no matches', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [], loading: true, error: false })
    const { rerender } = render(<MatchesTab customerId="cust-1" />)
    expect(screen.getByText(i18n.t('page.loading', { ns: 'customers' }))).toBeInTheDocument()

    mockUseCustomerMatches.mockReturnValue({ rows: [], loading: false, error: false })
    rerender(<MatchesTab customerId="cust-1" />)
    expect(screen.getByText(ct('matchesView.empty'))).toBeInTheDocument()
  })

  it('shows the error state on a failed fetch', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [], loading: false, error: true })
    render(<MatchesTab customerId="cust-1" />)
    expect(screen.getByText(i18n.t('matches.loadError', { ns: 'customers' }))).toBeInTheDocument()
  })

  it('renders the candidate (swapped from the candidate card\'s "Client" row), vacancy, contract form and contract status', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [row({ contractType: 'Fase 1-2 z.u.b.', contractStatus: 'active' })], loading: false, error: false })
    render(<MatchesTab customerId="cust-1" />)

    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.getByText('Fase 1-2 z.u.b.')).toBeInTheDocument()
    expect(screen.getByText(ct('matchesView.contractStatus.active'))).toBeInTheDocument()
  })

  it('resolves the stage from useMatchStatuses — the slug wins over the raw stage label', () => {
    // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
    mockUseCustomerMatches.mockReturnValue({ rows: [row({ status: 'open', stage: 'Fallback stage', stageColor: '#999999' })], loading: false, error: false })
    render(<MatchesTab customerId="cust-1" />)
    expect(metaOf).toHaveBeenCalledWith('open')
    expect(screen.getByText('Open (lookup)')).toBeInTheDocument()
    expect(screen.queryByText('Fallback stage')).toBeNull()
  })

  it('renders "Open match" as a real new-tab anchor, never an in-app-only button', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [row()], loading: false, error: false })
    render(<MatchesTab customerId="cust-1" />)
    const openLink = screen.getByTitle(ct('matchesView.openMatch'))
    expect(openLink.tagName).toBe('A')
    expect(openLink.getAttribute('href')).toContain('?open=m-1')
    expect(openLink.getAttribute('target')).toBe('_blank')
    expect(openLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  // Read-only per §3B: a match is opened/edited in its own drawer, never here —
  // unlike the candidate's own MatchesTab, this component never accepts an onEdit
  // prop at all, so no pencil/edit control can ever render.
  it('never renders a pencil/edit control — this tab has no onEdit prop at all', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [row()], loading: false, error: false })
    render(<MatchesTab customerId="cust-1" />)
    expect(screen.queryByRole('button', { name: 'common:edit' })).toBeNull()
    expect(screen.queryByTitle(i18n.t('common:edit'))).toBeNull()
  })
})
