/**
 * PickCandidateForAppointmentModal (VACDRAWER-ACTIONS-1) — step 1 (server-searched
 * candidate pick, browsable without typing, honest cap hint when the tenant has
 * more candidates than the capped page) → step 2 (hands the pick straight to the
 * shared PlanIntakeModal, vacancy preset). Mirrors MergeCandidateModal.test.tsx's
 * shape: assert the REQUEST params, not just "a callback fired" (§13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@/i18n'
import PickCandidateForAppointmentModal from './PickCandidateForAppointmentModal'

// Keep the REAL unwrapList (the paginator envelope math matters for the cap
// hint) — only the default client is stubbed (mirrors applications/drawer/
// AppointmentsTab.test.tsx's own convention). `vi.hoisted` since `vi.mock`
// factories are hoisted above any top-level const (mirrors MergeCandidateModal.test.tsx).
const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: getMock } }
})

// Deep-path stub (never the barrel — CLAUDE.md §2 TESTLES) so step 2 only
// proves the WIRING (candidateId + defaultVacancyId + mode), not the modal's
// own internals (covered by PlanIntakeModal.test.tsx).
interface StubModalProps { candidateId?: string; defaultVacancyId?: string | null; mode?: string }
vi.mock('@/pages/candidates/drawer/PlanIntakeModal', () => ({
  default: (props: StubModalProps) => (
    <div data-testid="plan-intake-modal">
      <span data-testid="modal-props">{JSON.stringify(props)}</span>
    </div>
  ),
}))

const candidateRow = (over: Record<string, unknown> = {}) =>
  ({ id: 'c-1', name: 'Jane Doe', function_title: 'Verpleegkundige', city: 'Amsterdam', ...over })

const paginated = (rows: unknown[], total: number) => ({ data: { data: rows, meta: { total, current_page: 1, last_page: 1, per_page: 25 } } })

beforeEach(() => { getMock.mockReset() })

describe('PickCandidateForAppointmentModal · candidate search (step 1)', () => {
  it('fetches the plain first page on mount, no search param sent for an empty box', async () => {
    getMock.mockResolvedValue(paginated([candidateRow()], 1))
    render(<PickCandidateForAppointmentModal vacancyId="v-1" onClose={vi.fn()} onCreated={vi.fn()} />)
    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/candidates', expect.objectContaining({ params: { per_page: 25 } })))
  })

  it('sends the typed term as `search` once the box is edited (debounced by SearchSelect itself)', async () => {
    getMock.mockResolvedValue(paginated([candidateRow()], 1))
    render(<PickCandidateForAppointmentModal vacancyId="v-1" onClose={vi.fn()} onCreated={vi.fn()} />)
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: /^kandidaat$/i }))
    fireEvent.change(screen.getByPlaceholderText(/zoeken/i), { target: { value: 'jane' } })
    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/candidates',
      expect.objectContaining({ params: { search: 'jane', per_page: 25 } })), { timeout: 2000 })
  })

  it('shows the honest "shown of total" hint when the tenant has more candidates than the capped page', async () => {
    getMock.mockResolvedValue(paginated([candidateRow()], 292))
    render(<PickCandidateForAppointmentModal vacancyId="v-1" onClose={vi.fn()} onCreated={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('1 van 292 getoond')).toBeInTheDocument())
  })

  it('shows no cap hint once every matching candidate already fits on the page', async () => {
    getMock.mockResolvedValue(paginated([candidateRow()], 1))
    render(<PickCandidateForAppointmentModal vacancyId="v-1" onClose={vi.fn()} onCreated={vi.fn()} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    expect(screen.queryByText(/getoond/)).not.toBeInTheDocument()
  })

  it('reports a failed search instead of silently showing an empty list', async () => {
    getMock.mockRejectedValue(new Error('boom'))
    render(<PickCandidateForAppointmentModal vacancyId="v-1" onClose={vi.fn()} onCreated={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Kandidaten konden niet worden geladen.')).toBeInTheDocument())
  })

  it('closes on Cancel without picking anyone', async () => {
    getMock.mockResolvedValue(paginated([], 0))
    const onClose = vi.fn()
    render(<PickCandidateForAppointmentModal vacancyId="v-1" onClose={onClose} onCreated={vi.fn()} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /annuleren/i }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('PickCandidateForAppointmentModal · pick → shared modal (step 2)', () => {
  it('hands the picked candidate to PlanIntakeModal with THIS vacancy preset and mode="appointment"', async () => {
    getMock.mockResolvedValue(paginated([candidateRow()], 1))
    render(<PickCandidateForAppointmentModal vacancyId="v-1" onClose={vi.fn()} onCreated={vi.fn()} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /^kandidaat$/i }))
    const option = await screen.findByText(/Jane Doe · Verpleegkundige · Amsterdam/)
    fireEvent.click(option)
    const shown = JSON.parse(screen.getByTestId('modal-props').textContent || '{}')
    expect(shown).toEqual({ candidateId: 'c-1', defaultVacancyId: 'v-1', mode: 'appointment' })
    // Step 1's own panel is gone once step 2 takes over.
    expect(screen.queryByPlaceholderText(/zoeken/i)).not.toBeInTheDocument()
  })
})
