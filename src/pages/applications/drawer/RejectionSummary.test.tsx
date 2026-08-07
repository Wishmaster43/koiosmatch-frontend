/**
 * RejectionSummary — the calm outcome card (Danny 25-07): nothing renders
 * without a rejection, the reason + meta line (sent-on/channel) render when
 * present, the not-sent fallback line, and (APP-REJECTION-EDIT-1, W28) the
 * correction pencil — its permission gate, that it opens RejectionModal in
 * correction mode PREFILLED from the existing rejection, the exact PATCH
 * request it fires (§13: assert the request, not just that a callback fired),
 * and that a backfill (no recorded reason yet) works the same way.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RejectionSummary from './RejectionSummary'
import type { ApplicationDetail } from '@/types/application'

// Key-echo (repo-wide precedent, e.g. ApplicationTab.test.tsx) — avoids the
// real i18n instance's async-init timing flipping assertions between raw keys
// and translated NL copy depending on run order. `defaultValue` on the channel
// key is intentionally ignored here (t is a pure key-echo), matching how a
// literal key would render when no translation resource has loaded yet.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// useDateFormat (@/lib/datetime) imports `@/i18n`, which needs a REAL
// react-i18next (initReactI18next) to initialise — stub the whole module
// (mirrors ApplicationTab.test.tsx) so nothing here touches the real singleton.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (d: unknown) => (d ? String(d) : '—'), formatDateTime: (d: unknown) => (d ? String(d) : '—') }),
  useLocale: () => 'nl-NL',
}))

// W28 mocks — the correction pencil mounts the REAL RejectionModal (its own
// reason lookup + submit), so this file mocks the same seam RejectionModal.
// test.tsx does, plus auth (mirrors InterviewStatusCard.test.tsx) and notify.
const mockUseAuth = vi.fn()
const mockGet = vi.fn()
const mockPatch = vi.fn()
const mockNotifySuccess = vi.fn()
const mockNotifyError = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/lib/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
  unwrap: (res: unknown) => {
    const body = (res as { data?: unknown })?.data ?? res
    if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) return (body as { data: unknown }).data
    return body
  },
  unwrapList: (res: { data?: { data?: unknown[] } }) =>
    ({ rows: res?.data?.data ?? [], total: 0, page: 1, lastPage: 1, perPage: 0 }),
}))
vi.mock('@/lib/notify', () => ({ notifySuccess: (...a: unknown[]) => mockNotifySuccess(...a), notifyError: (...a: unknown[]) => mockNotifyError(...a) }))

const mockReasons = [{ id: 'r1', name: 'Niet gekwalificeerd' }, { id: 'r2', name: 'Te ver weg' }]

const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, bucket: 'rejected', ...over,
} as unknown as ApplicationDetail)

beforeEach(() => {
  // resetAllMocks (not clearAllMocks): also drops leftover `…Once` queues, so a
  // test whose request never fires cannot hand its canned response to the next one.
  vi.resetAllMocks()
  mockUseAuth.mockReturnValue({ hasPermission: () => true })
  mockGet.mockResolvedValue({ data: { data: mockReasons } })
})

describe('RejectionSummary', () => {
  it('renders nothing for an application that is not rejected', () => {
    const { container } = render(<RejectionSummary application={app({ bucket: 'active', rejection: undefined })} />)
    expect(container).toBeEmptyDOMElement()
  })

  // A phase move (or the seeder) can land an application in the rejected bucket
  // with NO rejection record — measured live 25-07. Showing nothing would read as
  // "no data"; this states the gap instead, and (W28) offers the pencil to fix it.
  it('states the gap when the application is rejected without a recorded reason', () => {
    render(<RejectionSummary application={app({ bucket: 'rejected', rejection: undefined })} />)
    expect(screen.getByText('rejection.rejected')).toBeInTheDocument()
    expect(screen.getByText('rejection.noRecord')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'rejection.correctAction' })).toBeInTheDocument()
  })

  it('shows the reason, "verstuurd op" and the channel when all are present', () => {
    render(<RejectionSummary application={app({
      rejection: { reason_label: 'Niet gekwalificeerd', sent_at: '2026-07-20T10:00:00Z', channel: 'email' },
    })} />)
    expect(screen.getByText('rejection.rejected')).toBeInTheDocument()
    expect(screen.getByText('Niet gekwalificeerd')).toBeInTheDocument()
    expect(screen.getByText('rejection.sentOn · rejection.viaChannel')).toBeInTheDocument()
  })

  it('shows the not-sent line when sent_at is null', () => {
    render(<RejectionSummary application={app({ rejection: { reason_label: 'Te ver weg', sent_at: null } })} />)
    expect(screen.getByText('rejection.notSent')).toBeInTheDocument()
  })
})

// W28 (verified live: PATCH /applications/{id}/rejection exists,
// ApplicationController::updateRejection) — the correction pencil.
describe('RejectionSummary · correction pencil (W28)', () => {
  it('hides the pencil entirely without applications.update', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(<RejectionSummary application={app({
      rejection: { reason_id: 'r1', reason_label: 'Niet gekwalificeerd', sent_at: null },
    })} />)
    expect(screen.queryByRole('button', { name: 'rejection.correctAction' })).toBeNull()
  })

  it('checks the same permission string the route middleware requires', () => {
    const hasPermission = vi.fn().mockReturnValue(true)
    mockUseAuth.mockReturnValue({ hasPermission })
    render(<RejectionSummary application={app({
      rejection: { reason_id: 'r1', reason_label: 'Niet gekwalificeerd', sent_at: null },
    })} />)
    expect(hasPermission).toHaveBeenCalledWith('applications.update')
  })

  it('opens RejectionModal in correction mode, prefilled from the existing rejection — never the original reject copy', async () => {
    render(<RejectionSummary application={app({
      rejection: { reason_id: 'r1', reason_label: 'Niet gekwalificeerd', note: 'Oude toelichting', channel: 'email', sent_at: '2026-07-20T10:00:00Z' },
    })} />)
    await userEvent.click(screen.getByRole('button', { name: 'rejection.correctAction' }))
    expect(screen.getByText('rejection.correctModalTitle')).toBeInTheDocument()
    expect(screen.queryByText('rejection.modalTitle')).toBeNull()
    // The prefilled reason resolves once the lookup loads (async, mirrors RejectionModal.test.tsx).
    expect(await screen.findByRole('button', { name: 'Niet gekwalificeerd' })).toBeInTheDocument()
    // The AI-advice block is a decision aid for the ORIGINAL reject only.
    expect(screen.queryByText('rejection.aiAdvice')).toBeNull()
  })

  it('PATCHes /applications/{id}/rejection with exactly {reason_id, note} when saved unchanged, and updates the card in place', async () => {
    mockPatch.mockResolvedValueOnce({
      data: { data: { id: 1, rejection: {
        reason_id: 'r1', reason_label: 'Niet gekwalificeerd', note: 'Oude toelichting', channel: 'email', sent_at: '2026-07-20T10:00:00Z',
      } } },
    })
    render(<RejectionSummary application={app({
      rejection: { reason_id: 'r1', reason_label: 'Verkeerde reden', note: 'Oude toelichting', channel: 'email', sent_at: '2026-07-20T10:00:00Z' },
    })} />)
    await userEvent.click(screen.getByRole('button', { name: 'rejection.correctAction' }))
    await screen.findByRole('button', { name: 'Niet gekwalificeerd' })
    await userEvent.click(screen.getByText('rejection.saveCorrection'))
    // The REQUEST: exactly reason_id + note — never the stage, never channel/sent_at
    // (the backend would ignore extra fields regardless, but the contract is explicit).
    expect(mockPatch).toHaveBeenCalledWith('/applications/1/rejection', { reason_id: 'r1', note: 'Oude toelichting' })
    // The card adopts the server-resolved label — "Verkeerde reden" is gone.
    await waitFor(() => expect(screen.getByText('Niet gekwalificeerd')).toBeInTheDocument())
    expect(screen.queryByText('Verkeerde reden')).toBeNull()
    expect(mockNotifySuccess).toHaveBeenCalledWith('rejection.correctionDone')
  })

  it('lets a recruiter backfill a reason via the pencil when none was ever recorded', async () => {
    mockPatch.mockResolvedValueOnce({
      data: { data: { id: 1, rejection: { reason_id: 'r2', reason_label: 'Te ver weg', note: '', channel: null, sent_at: null } } },
    })
    render(<RejectionSummary application={app({ rejection: undefined })} />)
    expect(screen.getByText('rejection.noRecord')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'rejection.correctAction' }))
    await userEvent.click(await screen.findByRole('button', { name: 'rejection.reasonPlaceholder' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Te ver weg' }))
    await userEvent.click(screen.getByText('rejection.saveCorrection'))
    expect(mockPatch).toHaveBeenCalledWith('/applications/1/rejection', { reason_id: 'r2', note: '' })
    await waitFor(() => expect(screen.getByText('Te ver weg')).toBeInTheDocument())
    expect(screen.queryByText('rejection.noRecord')).toBeNull()
  })

  it('closes without persisting when Annuleren is clicked', async () => {
    render(<RejectionSummary application={app({
      rejection: { reason_id: 'r1', reason_label: 'Niet gekwalificeerd', sent_at: null },
    })} />)
    await userEvent.click(screen.getByRole('button', { name: 'rejection.correctAction' }))
    await screen.findByText('rejection.correctModalTitle')
    await userEvent.click(screen.getByText('common:cancel'))
    expect(mockPatch).not.toHaveBeenCalled()
    expect(screen.queryByText('rejection.correctModalTitle')).toBeNull()
  })

  it('surfaces a failed correction via extractApiError and keeps the card unchanged', async () => {
    mockPatch.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Correction failed' } } })
    render(<RejectionSummary application={app({
      rejection: { reason_id: 'r1', reason_label: 'Niet gekwalificeerd', sent_at: null },
    })} />)
    await userEvent.click(screen.getByRole('button', { name: 'rejection.correctAction' }))
    await screen.findByRole('button', { name: 'Niet gekwalificeerd' })
    await userEvent.click(screen.getByText('rejection.saveCorrection'))
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('Correction failed'))
    // Still open, still the original label (shown both on the card underneath
    // and the still-open picker's own trigger) — a failed save never fakes a result.
    expect(screen.getByText('rejection.correctModalTitle')).toBeInTheDocument()
    expect(screen.getAllByText('Niet gekwalificeerd').length).toBeGreaterThan(0)
  })
})
