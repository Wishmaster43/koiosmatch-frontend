/** PlanIntakeModal · type defaults, no type fallback and AXIS-MATRIX-2 preflight (split from PlanIntakeModal.test.tsx). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanIntakeModal from './PlanIntakeModal'
import api from '@/lib/api'
import { useActionRulePreflight } from '@/components/actionrules'
import { useAppointmentTypes } from '@/lib/useAppointmentTypes'
// Reused so per-test fixtures (incl. an empty-types shape the hook's own typing
// doesn't perfectly model) don't fight TS literal-widening on `default_modality`.
type AppointmentTypesResult = ReturnType<typeof useAppointmentTypes>

// Two assignable users — 'u1' is the logged-in user (see the useAuth mock below),
// 'u2' is a DIFFERENT candidate owner, so RECRUITER-DEFAULT-1's priority (candidate
// owner over the logged-in-user fallback) is actually observable in PlanIntakeModal.test.tsx.
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Piet Recruiter' }, { id: 'u2', name: 'Els Recruiter' }] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Piet Recruiter' } }) }))
// One default type, DEFAULT + FIRST in the list — the common case. `vi.fn` (not a
// plain arrow) so individual tests below can override it with `mockReturnValue`
// to exercise a tenant whose default type ISN'T first (S24a-c fix) or has none
// configured at all (the removed hardcoded 'intake' fallback).
const DEFAULT_APPT_TYPES = {
  types: [{ value: 'intake_flex', label: 'Intake Flex', default_duration_min: 30, default_modality: 'office', is_intake: true, is_default: true }],
  intakeTypes: [{ value: 'intake_flex', label: 'Intake Flex', default_duration_min: 30, default_modality: 'office', is_intake: true, is_default: true }],
  metaOf: () => ({ default_duration_min: 30, default_modality: 'office' }),
  defaultType: { value: 'intake_flex', label: 'Intake Flex', default_duration_min: 30, default_modality: 'office', is_intake: true, is_default: true },
} as AppointmentTypesResult
vi.mock('@/lib/useAppointmentTypes', () => ({ useAppointmentTypes: vi.fn() }))
vi.mock('@/lib/useAppointmentLocations', () => ({
  useAppointmentLocations: () => ({
    locations: [{ value: 'kantoor', label: 'Kantoor', is_default: true }],
    defaultLocation: { value: 'kantoor', label: 'Kantoor', is_default: true },
    metaOf: () => undefined,
  }),
}))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [] }))
// A STABLE empty array — the real useVacancyOptions (react-query) only produces a new
// reference when its data actually changes; a naive `() => []` mock would hand back a
// fresh array every render, which the vacancy-title effect below depends on and would
// then re-fire (and re-fetch) on every render instead of just when vacancyId changes.
const { EMPTY_VACANCIES } = vi.hoisted(() => ({ EMPTY_VACANCIES: [] as unknown[] }))
vi.mock('../hooks/useVacancyOptions', () => ({ useVacancyOptions: () => EMPTY_VACANCIES }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.reject({ response: { status: 404 } })), post: vi.fn(), patch: vi.fn() },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
}))
// Only the network-backed hook is stubbed (defaults to "no decision") — the real
// ActionRuleBanner renders, so the AXIS-MATRIX-2 tests below exercise the actual component.
vi.mock('@/components/actionrules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/actionrules')>()),
  useActionRulePreflight: vi.fn(() => ({ decision: null, loading: false, error: false })),
}))

const noop = () => {}

// Reset the appointment-types mock to the common-case fixture before every test —
// only the tests that need a different tenant configuration override it themselves.
// Also clear the api spies' call history (no global resetMocks in vite.config.js) —
// otherwise a "never calls the API" assertion below would see earlier tests' calls.
beforeEach(() => {
  vi.mocked(useAppointmentTypes).mockReturnValue(DEFAULT_APPT_TYPES)
  vi.mocked(api.post).mockClear()
  vi.mocked(api.get).mockClear()
  vi.mocked(api.patch).mockClear()
  // Reset the action-rule preflight mock back to "no decision" (§13 test hygiene
  // fix, found by the MODALITY-PHONE-CLEAR-1 tests in PlanIntakeModal.modality.test.tsx): a test inside the
  // AXIS-MATRIX-2 describe block sets a persistent `mockReturnValue` (warn/block)
  // that otherwise LEAKS into every CREATE-mode test that runs after it in this
  // file — a leaked 'block' decision silently disables the submit button, so a
  // later test's click does nothing and its POST assertion sees zero calls.
  vi.mocked(useActionRulePreflight).mockReturnValue({ decision: null, loading: false, error: false })
})

// BUG FIX (S24a-c): `duration`/`modality` used to prefill from `typeOptions[0]` —
// the FIRST option in the list — while `type` itself already prefilled from the
// resolved DEFAULT option. For a tenant whose default type isn't first, the modal
// opened showing the right type next to another type's duration/modality, and the
// type resync effect never caught it (the type itself was already a valid pick).
describe('PlanIntakeModal · default type/duration/modality come from the SAME option', () => {
  it('prefills duration + modality from the tenant DEFAULT type even when it is not first in the list', async () => {
    vi.mocked(useAppointmentTypes).mockReturnValue({
      types: [
        { value: 'quick_call', label: 'Quick call', default_duration_min: 15, default_modality: 'phone', is_intake: true, is_default: false },
        { value: 'intake_flex', label: 'Intake Flex', default_duration_min: 45, default_modality: 'remote', is_intake: true, is_default: true },
      ],
      intakeTypes: [
        { value: 'quick_call', label: 'Quick call', default_duration_min: 15, default_modality: 'phone', is_intake: true, is_default: false },
        { value: 'intake_flex', label: 'Intake Flex', default_duration_min: 45, default_modality: 'remote', is_intake: true, is_default: true },
      ],
      metaOf: () => undefined,
      defaultType: { value: 'intake_flex', label: 'Intake Flex', default_duration_min: 45, default_modality: 'remote', is_intake: true, is_default: true },
    } as AppointmentTypesResult)
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'work.createIntake' }))
    // The default type ('intake_flex', 45min/remote) must reach the POST body —
    // not the first list entry's ('quick_call', 15min/phone) duration/modality.
    expect(api.post).toHaveBeenCalledWith('/candidates/cand-1/appointments', expect.objectContaining({
      type: 'intake_flex', duration_min: 45, modality: 'remote',
    }))
  })
})

// BUG FIX: the submit body used to fall back to the hardcoded slug `type: type ||
// 'intake'` — not a real tenant vocabulary entry (appointment types are tenant-
// configurable, §3B) and never guaranteed to exist. When a tenant has zero
// appointment types configured, there is nothing honest to submit — the form now
// refuses (disabled submit button, no POST) instead of guessing a slug.
describe('PlanIntakeModal · no hardcoded type fallback', () => {
  it('disables submit and never calls the API when the tenant has no appointment types configured', () => {
    vi.mocked(useAppointmentTypes).mockReturnValue({
      types: [], intakeTypes: [], metaOf: () => undefined, defaultType: undefined,
    } as unknown as AppointmentTypesResult)
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    const submitBtn = screen.getByRole('button', { name: 'work.createIntake' })
    expect(submitBtn).toBeDisabled()
    fireEvent.click(submitBtn)
    expect(api.post).not.toHaveBeenCalled()
  })
})

describe('PlanIntakeModal · AXIS-MATRIX-2 preflight (CMFE audit R1)', () => {
  it('warn: shows the banner but leaves the submit button enabled', () => {
    vi.mocked(useActionRulePreflight).mockReturnValue({
      decision: { effect: 'warn', popup_code: 'P1', message: 'Piet is tijdelijk niet inzetbaar (ziek).' }, loading: false, error: false,
    })
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.getByTestId('action-rule-banner')).toHaveAttribute('data-effect', 'warn')
    expect(screen.getByRole('button', { name: 'work.createIntake' })).toBeEnabled()
  })

  it('block: shows the banner and disables the submit button', () => {
    vi.mocked(useActionRulePreflight).mockReturnValue({
      decision: { effect: 'block', popup_code: 'P3', message: 'Piet staat op de blacklist.' }, loading: false, error: false,
    })
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.getByTestId('action-rule-banner')).toHaveAttribute('data-effect', 'block')
    expect(screen.getByRole('button', { name: 'work.createIntake' })).toBeDisabled()
  })

  it('never gates the EDIT path — the backend guard only runs on create, so a block decision is not even shown', () => {
    vi.mocked(useActionRulePreflight).mockReturnValue({
      decision: { effect: 'block', popup_code: 'P3', message: 'Piet staat op de blacklist.' }, loading: false, error: false,
    })
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop}
      existing={{ id: 'appt-1', scheduled_at: '2026-07-20T10:00:00Z', type: 'intake_flex' }} />)
    expect(screen.queryByTestId('action-rule-banner')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common:save' })).toBeEnabled()
  })
})

// VAC-CLEAR in the intake modal (Danny 13-08): the hint says 'laat leeg', so a
// picked vacancy must be releasable — the clear cross resets to no-vacancy.
it('clears a picked vacancy back to an intake without vacancy', async () => {
  render(<PlanIntakeModal candidateId="cand-1" defaultVacancyId="v1" onClose={noop} onCreated={noop} />)
  // The VAC-CLEAR cross carries the field name in its accessible name.
  const clear = await screen.findByTitle(/clearField/i)
  fireEvent.click(clear)
  // The picker shows its placeholder again — nothing selected.
  expect(await screen.findByText(/work\.noVacancy/i)).toBeInTheDocument()
})

// KOIOS-VOORSTEL-1: the suggested vacancy renders the Koios badge — and the badge
// dissolves the moment the recruiter clears the proposal (then it is their choice).
it('shows the Koios badge on a SUGGESTED vacancy and dissolves it on clear', async () => {
  render(<PlanIntakeModal candidateId="cand-1" suggestedVacancyId="v1" onClose={noop} onCreated={noop} />)
  expect(await screen.findByTestId('koios-suggestion')).toBeInTheDocument()
  fireEvent.click(await screen.findByTitle(/clearField/i))
  expect(screen.queryByTestId('koios-suggestion')).toBeNull()
})

it('shows NO badge for an explicit defaultVacancyId (context, not a proposal)', async () => {
  render(<PlanIntakeModal candidateId="cand-1" defaultVacancyId="v1" onClose={noop} onCreated={noop} />)
  fireEvent.click(await screen.findByTitle(/clearField/i)) // sanity: field seeded
  expect(screen.queryByTestId('koios-suggestion')).toBeNull()
})

// CLEAR-SWEEP seam test (control round 13-08: placeholder-asserts let a dead edit
// path ship green). Editing an appointment, clearing the vacancy and saving must
// PATCH vacancy_id: null — an omitted key means 'unchanged' server-side.
it('edit + clear + save PATCHes vacancy_id: null (the request, not the placeholder)', async () => {
  render(<PlanIntakeModal candidateId="cand-1"
    existing={{ id: 'appt-1', scheduled_at: '2026-08-14T10:00', vacancy_id: 'v1' }}
    onClose={noop} onCreated={noop} />)
  fireEvent.click(await screen.findByTitle(/clearField/i))
  fireEvent.click(screen.getByRole('button', { name: /work\.saveAppointment|common:save|save/i }))
  await waitFor(() => {
    const patch = vi.mocked(api.patch).mock.calls.at(-1)
    expect(patch?.[1]).toMatchObject({ vacancy_id: null })
  })
})
