import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CandidateTab from './CandidateTab'
import { peekReturnTab } from './constants'
// CandidateTab statically imports the full candidate tab set, several of which
// pull in @/lib/datetime — which re-exports from @/i18n, so importing it (even
// unrendered, behind the loading state below) initialises the REAL i18n runtime
// for this test file (unlike a lighter drawer tab test, which sees raw keys).
// Use the real instance to compute expected strings instead of hardcoding NL text.
import i18n from '@/i18n'
import type { ApplicationDetail } from '@/types/application'

// The full candidate fetch (GET /candidates/{id}) is irrelevant here — this test
// only asserts the header that renders BEFORE it resolves, so the promise is left
// pending forever (never resolves, never rejects).
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})), patch: vi.fn(() => Promise.resolve()) },
  unwrap: (r: unknown) => r,
}))

// Minimal application detail — only the fields CandidateTab's header reads.
const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, candidateId: 7,
  candidate: {
    name: 'Jan Jansen', initials: 'JJ', function: '',
    statusLabel: 'Beschikbaar', statusColor: '#2E7D32',
    gender: '', nationality: '', dob: '', email: '', phone: '', address: '', summary: '',
  },
  candidateStatus: 'available', candidatePhase: 'candidate',
  ...over,
} as unknown as ApplicationDetail)

describe('CandidateTab', () => {
  it('shows the candidate name WITHOUT a status chip (Danny 21-07: the drawer header already carries the application status)', () => {
    render(<CandidateTab application={app()} />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    // No second (candidate-deployability) status chip here — that read as "two statuses".
    expect(screen.queryByTestId('status-chip')).not.toBeInTheDocument()
    expect(screen.queryByText('Beschikbaar')).not.toBeInTheDocument()
    // The nested fetch never resolves in this test — the tab body stays the loading state.
    expect(screen.getByText(i18n.t('applications:candidateDetail.loading'))).toBeInTheDocument()
  })

  it('links to the full candidate record', () => {
    render(<CandidateTab application={app()} />)
    expect(screen.getByTitle(i18n.t('applications:drawer.openCandidate'))).toBeInTheDocument()
  })

  // S14/S22: clicking through to the full candidate stashes 'candidate' as the
  // return tab, so browser BACK reopens this application's drawer on Kandidaat.
  it('stashes the return tab before navigating to the full candidate', async () => {
    const user = userEvent.setup()
    render(<CandidateTab application={app({ id: 42 })} />)
    await user.click(screen.getByTitle(i18n.t('applications:drawer.openCandidate')))
    expect(peekReturnTab(42)).toBe('candidate')
  })
})
