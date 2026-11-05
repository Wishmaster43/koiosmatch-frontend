/** PlanIntakeModal · modality axis and phone stale-location clearing (split from PlanIntakeModal.test.tsx). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
// ActionRuleBanner renders, so the AXIS-MATRIX-2 tests (PlanIntakeModal.preflight.test.tsx) exercise the actual component.
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
  // Reset the action-rule preflight mock back to "no decision" (§13 test hygiene). The reset
  // mirrors PlanIntakeModal.preflight.test.tsx, where the AXIS-MATRIX-2 tests set a persistent
  // `mockReturnValue` (warn/block); here it is defensive, since vitest isolates modules per file.
  vi.mocked(useActionRulePreflight).mockReturnValue({ decision: null, loading: false, error: false })
})

// Afspraak-as (C.14, Danny 31-08 — Opus verifier round, fixed 02-09): `modality`
// (office/remote/phone, proposed by the appointment type) is a fixed AXIS, shown
// read-only right after Type; the "where" combobox below it is its DETAIL. The
// verifier found the ORIGINAL slice faked an address-vs-link distinction the
// backend cannot honour (StoreAppointmentRequest::lookupRules validates
// `appointment_location` against the tenant's configured lookup slugs whenever one
// exists — free text 422s for any tenant with a configured lookup, i.e. virtually
// every live tenant), so the detail field is now ONE neutral picker for both
// office and remote, and a stale pick must never survive a switch to phone.
describe('PlanIntakeModal · Afspraak-as (modality axis + its detail field)', () => {
  const typeFixture = (modality: 'office' | 'remote' | 'phone') => ({
    types: [{ value: 't1', label: 'Type 1', default_duration_min: 30, default_modality: modality, is_intake: true, is_default: true }],
    intakeTypes: [{ value: 't1', label: 'Type 1', default_duration_min: 30, default_modality: modality, is_intake: true, is_default: true }],
    metaOf: () => ({ default_duration_min: 30, default_modality: modality }),
    defaultType: { value: 't1', label: 'Type 1', default_duration_min: 30, default_modality: modality, is_intake: true, is_default: true },
  } as AppointmentTypesResult)

  it('shows the resolved modality read-only, visible before saving (office)', () => {
    vi.mocked(useAppointmentTypes).mockReturnValue(typeFixture('office'))
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.getByText('work.modality')).toBeInTheDocument()
    expect(screen.getByText('work.modalityOffice')).toBeInTheDocument()
  })

  it('shows the resolved modality read-only, visible before saving (remote)', () => {
    vi.mocked(useAppointmentTypes).mockReturnValue(typeFixture('remote'))
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.getByText('work.modality')).toBeInTheDocument()
    expect(screen.getByText('work.modalityRemote')).toBeInTheDocument()
  })

  it('shows the resolved modality read-only, visible before saving (phone)', () => {
    vi.mocked(useAppointmentTypes).mockReturnValue(typeFixture('phone'))
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.getByText('work.modality')).toBeInTheDocument()
    expect(screen.getByText('work.modalityPhone')).toBeInTheDocument()
  })

  it('shows the SAME neutral location picker for an on-location (office) appointment — no address-only wording', () => {
    vi.mocked(useAppointmentTypes).mockReturnValue(typeFixture('office'))
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.getByText('work.modalityWhere')).toBeInTheDocument()
    // Accessible name is composed from the row label (verifier point 5) — never
    // just the placeholder text — proving the label id is actually wired in.
    // DROPDOWN-CLEAR-1: filter to the trigger button (has aria-haspopup), not the clear X.
    const modalityButtons = screen.getAllByRole('button', { name: /work\.modalityWhere/ })
    expect(modalityButtons.find(btn => btn.hasAttribute('aria-haspopup'))).toBeInTheDocument()
  })

  it('shows the SAME neutral location picker for a remote (video) appointment — BE only accepts configured lookup slugs, never free text', () => {
    vi.mocked(useAppointmentTypes).mockReturnValue(typeFixture('remote'))
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.getByText('work.modalityWhere')).toBeInTheDocument()
    // DROPDOWN-CLEAR-1: filter to the trigger button (has aria-haspopup), not the clear X.
    const modalityButtons = screen.getAllByRole('button', { name: /work\.modalityWhere/ })
    expect(modalityButtons.find(btn => btn.hasAttribute('aria-haspopup'))).toBeInTheDocument()
  })

  it('hides the detail field entirely for a phone appointment', () => {
    vi.mocked(useAppointmentTypes).mockReturnValue(typeFixture('phone'))
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.queryByText('work.modalityWhere')).not.toBeInTheDocument()
    expect(document.getElementById('intake-where')).not.toBeInTheDocument()
  })
})

// MODALITY-PHONE-CLEAR-1 (Opus verifier, HIGH): a phone appointment hides the
// detail row, but the OLD form state still carried whatever office/remote value
// was seeded or picked earlier — proven live by the verifier: submitting after
// switching to a phone type sent the stale appointment_location/location_id.
// Asserting the REQUEST (§13), not just the hidden UI.
describe('PlanIntakeModal · MODALITY-PHONE-CLEAR-1 (phone never submits a stale location)', () => {
  const phoneFixture = {
    types: [{ value: 't1', label: 'Bel-intake', default_duration_min: 15, default_modality: 'phone', is_intake: true, is_default: true }],
    intakeTypes: [{ value: 't1', label: 'Bel-intake', default_duration_min: 15, default_modality: 'phone', is_intake: true, is_default: true }],
    metaOf: () => ({ default_duration_min: 15, default_modality: 'phone' }),
    defaultType: { value: 't1', label: 'Bel-intake', default_duration_min: 15, default_modality: 'phone', is_intake: true, is_default: true },
  } as AppointmentTypesResult

  it('sends location_id and appointment_location as null when the (default) type is a phone appointment', async () => {
    vi.mocked(useAppointmentTypes).mockReturnValue(phoneFixture)
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'work.createIntake' }))
    expect(api.post).toHaveBeenCalledWith('/candidates/cand-1/appointments', expect.objectContaining({
      modality: 'phone', location_id: null, appointment_location: null,
    }))
  })

  it('clears a picked location when the recruiter switches TO a phone type, before submit', async () => {
    vi.mocked(useAppointmentTypes).mockReturnValue({
      types: [
        { value: 'office_type', label: 'Intake kantoor', default_duration_min: 30, default_modality: 'office', is_intake: true, is_default: true },
        { value: 'phone_type', label: 'Bel-intake', default_duration_min: 15, default_modality: 'phone', is_intake: true, is_default: false },
      ],
      intakeTypes: [
        { value: 'office_type', label: 'Intake kantoor', default_duration_min: 30, default_modality: 'office', is_intake: true, is_default: true },
        { value: 'phone_type', label: 'Bel-intake', default_duration_min: 15, default_modality: 'phone', is_intake: true, is_default: false },
      ],
      metaOf: (v: string) => v === 'phone_type'
        ? { default_duration_min: 15, default_modality: 'phone' }
        : { default_duration_min: 30, default_modality: 'office' },
      defaultType: { value: 'office_type', label: 'Intake kantoor', default_duration_min: 30, default_modality: 'office', is_intake: true, is_default: true },
    } as AppointmentTypesResult)
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    // Starts on the office type — the tenant default location ('kantoor') is seeded.
    expect(await screen.findByText('work.modalityWhere')).toBeInTheDocument()

    // Switch to the phone type via the Type picker.
    await user.click(screen.getByRole('button', { name: 'Intake kantoor' }))
    await user.click(await screen.findByRole('button', { name: 'Bel-intake' }))

    // The detail row disappears — nothing left to submit.
    expect(screen.queryByText('work.modalityWhere')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'work.createIntake' }))
    expect(api.post).toHaveBeenCalledWith('/candidates/cand-1/appointments', expect.objectContaining({
      modality: 'phone', location_id: null, appointment_location: null,
    }))
  })

  it('still shows a location-related 422 error even though the detail row is hidden for a phone appointment', async () => {
    vi.mocked(useAppointmentTypes).mockReturnValue(phoneFixture)
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { errors: { appointment_location: ['invalid'] } } } })
    const user = userEvent.setup()
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.queryByText('work.modalityWhere')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'work.createIntake' }))
    // The picker itself stays hidden (nothing to fill in for phone) but the error
    // still surfaces (verifier point 4) — a hidden field must not swallow its 422.
    expect(await screen.findByText('common:required')).toBeInTheDocument()
    expect(screen.getByText('work.modalityWhere')).toBeInTheDocument()
    expect(document.getElementById('intake-where')).not.toBeInTheDocument()
  })
})
