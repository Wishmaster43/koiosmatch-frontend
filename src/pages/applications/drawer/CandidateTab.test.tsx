import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CandidateTab from './CandidateTab'
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

// CandidateStatusChip's own lookup-resolution logic (LookupsContext) is out of
// scope here — stub it so this test only asserts CandidateTab wires the RIGHT
// props (payload: candidate.status/status_label/status_color) into it.
vi.mock('@/components/ui/CandidateStatusChip', () => ({
  default: ({ status, phase, fallbackLabel, fallbackColor }: Record<string, unknown>) => (
    <span data-testid="status-chip">{String(status)}|{String(phase)}|{String(fallbackLabel)}|{String(fallbackColor)}</span>
  ),
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
  it('shows the candidate name + deployability status chip immediately, before the full candidate loads', () => {
    render(<CandidateTab application={app()} />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByTestId('status-chip')).toHaveTextContent('available|candidate|Beschikbaar|#2E7D32')
    // The nested fetch never resolves in this test — the tab body stays the loading state.
    expect(screen.getByText(i18n.t('applications:candidateDetail.loading'))).toBeInTheDocument()
  })

  it('falls back to the pre-resolved label/colour when no status slug is sent yet', () => {
    render(<CandidateTab application={app({ candidateStatus: '', candidatePhase: '' })} />)
    expect(screen.getByTestId('status-chip')).toHaveTextContent('||Beschikbaar|#2E7D32')
  })

  it('links to the full candidate record', () => {
    render(<CandidateTab application={app()} />)
    expect(screen.getByTitle(i18n.t('applications:drawer.openCandidate'))).toBeInTheDocument()
  })
})
