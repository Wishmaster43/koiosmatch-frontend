/**
 * usePlanIntakeForm — regression coverage for two measured bugs (CMFE audit):
 *
 * 1. The vacancy-title fetch (for a stored vacancy missing from the options list)
 *    used to carry only an `alive` boolean, no AbortController — inconsistent with
 *    every other entity-keyed load in this codebase (§9; mirrors VacancySearchTab's
 *    own vacancy-title fetch / useRateProposal). A fast vacancy-id switch must
 *    actually CANCEL the stale in-flight request, not just ignore its result.
 * 2. The submit body used to fall back to the hardcoded slug `type: type ||
 *    'intake'` — not a real tenant vocabulary entry (appointment types are
 *    tenant-configurable, §3B). When a tenant has zero configured appointment
 *    types there is nothing honest to send; submit now refuses instead of
 *    guessing a slug that may not exist server-side.
 *
 * These run at the HOOK level (mirrors matchPlacement/useCascadeDefaults.test.ts)
 * so the assertions reach the internal guard/effect directly, independent of the
 * component's own disabled-button gate (covered separately in
 * PlanIntakeModal.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlanIntakeForm } from './usePlanIntakeForm'
import api from '@/lib/api'
import { useAppointmentTypes } from '@/lib/useAppointmentTypes'
// The hook's own return type — reused so the test fixtures (which include an
// empty-types shape the hook's own typing doesn't perfectly model) don't fight
// TS literal-widening on `default_modality` field-by-field.
type AppointmentTypesResult = ReturnType<typeof useAppointmentTypes>

vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/lib/useAppointmentTypes', () => ({ useAppointmentTypes: vi.fn() }))
vi.mock('@/lib/useAppointmentLocations', () => ({
  useAppointmentLocations: () => ({ locations: [], defaultLocation: null, metaOf: () => undefined }),
}))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [] }))
// Empty option list — a picked vacancy id never matches, so the extraVacancy
// title-fetch effect always has something to fetch (what's under test below).
vi.mock('../../hooks/useVacancyOptions', () => ({ useVacancyOptions: () => [] }))
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))
vi.mock('@/components/actionrules', () => ({ useActionRulePreflight: () => ({ decision: null, loading: false, error: false }) }))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.reject({ response: { status: 404 } })), post: vi.fn(), patch: vi.fn() },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
}))

// One default appointment type — enough for the "type resolves fine" baseline.
const ONE_TYPE = {
  types: [{ value: 'intake_flex', label: 'Intake Flex', default_duration_min: 30, default_modality: 'office', is_intake: true, is_default: true }],
  intakeTypes: [{ value: 'intake_flex', label: 'Intake Flex', default_duration_min: 30, default_modality: 'office', is_intake: true, is_default: true }],
  metaOf: () => ({ default_duration_min: 30, default_modality: 'office' }),
  defaultType: { value: 'intake_flex', label: 'Intake Flex', default_duration_min: 30, default_modality: 'office', is_intake: true, is_default: true },
} as AppointmentTypesResult

beforeEach(() => { vi.mocked(useAppointmentTypes).mockReturnValue(ONE_TYPE) })

const noop = () => {}

describe('usePlanIntakeForm · vacancy-title fetch cancellation (§9)', () => {
  it('aborts the previous vacancy-title request when the id changes before it resolves', () => {
    // Capture the signal each GET was called with; never resolve so only the
    // cancellation behaviour is under test, not the eventual response handling.
    // Typed `unknown` — axios' own `GenericAbortSignal` config type is narrower
    // than DOM's `AbortSignal`, so reads below narrow it locally instead.
    const signals: unknown[] = []
    vi.mocked(api.get).mockImplementation((_url, config) => {
      signals.push(config?.signal)
      return new Promise(() => {})
    })
    const aborted = (s: unknown) => (s as { aborted?: boolean } | undefined)?.aborted

    const { result } = renderHook(() => usePlanIntakeForm({
      candidateId: 'cand-1', onClose: noop, onCreated: noop, defaultVacancyId: 'vac-1',
    }))
    expect(signals).toHaveLength(1)
    expect(signals[0]).toBeInstanceOf(AbortSignal)
    expect(aborted(signals[0])).toBe(false)

    // Switch to a different vacancy before the first request ever resolves.
    act(() => { result.current.setVacancyId('vac-2') })
    expect(signals).toHaveLength(2)
    // The FIRST (now-stale) request's own signal must have been aborted — a plain
    // `alive` boolean can only ignore the late response, it can never cancel the
    // underlying network request itself.
    expect(aborted(signals[0])).toBe(true)
  })
})

describe('usePlanIntakeForm · no hardcoded type fallback', () => {
  it('refuses to submit (never calls the API) when the tenant has no appointment types configured', async () => {
    vi.mocked(useAppointmentTypes).mockReturnValue({
      types: [], intakeTypes: [], metaOf: () => undefined, defaultType: undefined,
    } as unknown as AppointmentTypesResult)
    const { result } = renderHook(() => usePlanIntakeForm({ candidateId: 'cand-1', onClose: noop, onCreated: noop }))
    // `when` already defaults to "now, rounded to the quarter" — `type` is the only blocker.
    expect(result.current.when).not.toBe('')
    expect(result.current.type).toBe('')

    await act(async () => { await result.current.submit() })
    expect(api.post).not.toHaveBeenCalled()
  })

  it('submits the resolved default type as-is — no substitution with a hardcoded slug', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    const { result } = renderHook(() => usePlanIntakeForm({ candidateId: 'cand-1', onClose: noop, onCreated: noop }))
    expect(result.current.type).toBe('intake_flex')

    await act(async () => { await result.current.submit() })
    expect(api.post).toHaveBeenCalledWith('/candidates/cand-1/appointments', expect.objectContaining({ type: 'intake_flex' }))
  })
})
