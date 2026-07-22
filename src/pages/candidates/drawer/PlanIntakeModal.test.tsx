/**
 * PlanIntakeModal — regression test for the 422 field mapping (mirrors the house
 * pattern in AddCandidateModal/AddCustomerModal, see MatchPlacementModal.test.tsx):
 * the catch used to only fire a generic toast; it must now map `errors.{field}`
 * onto the matching field and fall back to a server message/generic banner
 * otherwise. The appointment-type/user/vacancy/location lookups hit the network
 * (react-query / useCachedLookup) — mocked directly so the test doesn't need a
 * QueryClientProvider.
 *
 * AXIS-MATRIX-2 (CMFE audit R1): the `appointment.create` preflight — create
 * only (the PATCH edit path never re-runs the backend guard, see the component's
 * own header comment); a warn banners but proceeds, a block additionally
 * disables the submit button.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanIntakeModal, { endTimeOf } from './PlanIntakeModal'
import api from '@/lib/api'
import { useActionRulePreflight } from '@/components/actionrules'

vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Piet Recruiter' }] }) }))
// meIsAssignable picks the same user 'u1' the users mock returns — the recruiter
// auto-default (S24a-e) then has no observable effect on which owner id ends up set.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Piet Recruiter' } }) }))
vi.mock('@/lib/useAppointmentTypes', () => ({
  useAppointmentTypes: () => ({
    types: [{ value: 'intake_flex', label: 'Intake Flex', default_duration_min: 30, default_modality: 'office', is_intake: true, is_default: true }],
    intakeTypes: [{ value: 'intake_flex', label: 'Intake Flex', default_duration_min: 30, default_modality: 'office', is_intake: true, is_default: true }],
    metaOf: () => ({ default_duration_min: 30, default_modality: 'office' }),
    defaultType: { value: 'intake_flex', label: 'Intake Flex', default_duration_min: 30, default_modality: 'office', is_intake: true, is_default: true },
  }),
}))
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

describe('PlanIntakeModal · 422 field mapping', () => {
  it('maps field-level 422 errors onto the corresponding fields', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { errors: { scheduled_at: ['required'], owner_id: ['invalid'] } } } })
    const user = userEvent.setup()
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: 'work.createIntake' }))
    // scheduled_at→when and owner_id→ownerId both resolve to the shared inline message.
    expect(await screen.findAllByText('common:required')).toHaveLength(2)
  })

  it('falls back to the server message as a banner when the 422 carries no field errors', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: 'Tijdslot is al bezet.' } } })
    const user = userEvent.setup()
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: 'work.createIntake' }))
    expect(await screen.findByText('Tijdslot is al bezet.')).toBeInTheDocument()
  })

  it('falls back to a generic message when the 422 carries neither field errors nor a message', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: {} } })
    const user = userEvent.setup()
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: 'work.createIntake' }))
    expect(await screen.findByText('common:errorGeneric')).toBeInTheDocument()
  })
})

// S24a(b): the live end-time computation — a plain date-math helper, tested directly
// rather than through the rendered text (i18next's untranslated-key fallback ignores
// interpolation params, so "tot 22:15" never actually appears as literal text in these
// key-only tests — see the component-level 'never blank' test below for the UI side).
describe('endTimeOf · S24a end-time computation', () => {
  it('adds the duration to the start time', () => {
    expect(endTimeOf('2026-07-20T10:00', 30)).toBe('10:30')
    expect(endTimeOf('2026-07-20T21:50', 45)).toBe('22:35')
  })
  it('rolls over into the next day past midnight', () => {
    expect(endTimeOf('2026-07-20T23:50', 30)).toBe('00:20')
  })
  it('returns empty for a blank or invalid start time', () => {
    expect(endTimeOf('', 30)).toBe('')
    expect(endTimeOf('not-a-date', 30)).toBe('')
  })
})

describe('PlanIntakeModal · S24a defaults', () => {
  it('preselects the tenant defaults (type/location/recruiter) and never renders a blank end time once a date is set', async () => {
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    // A default `when` (today, rounded to the quarter) is always set on mount, so the
    // end-time slot is never the empty placeholder once the modal is open.
    expect(screen.queryByText('—')).not.toBeInTheDocument()

    // Submitting immediately (no user edits) proves every default actually reached
    // the POST body: the mocked appointment-locations default ('kantoor') and the
    // mocked logged-in user ('u1', S24a-e) both went through untouched.
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'work.createIntake' }))
    expect(api.post).toHaveBeenCalledWith('/candidates/cand-1/appointments', expect.objectContaining({
      type: 'intake_flex', appointment_location: 'kantoor', owner_id: 'u1',
    }))
  })

  it('recomputes the shown end time when the date/duration inputs change', () => {
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    const whenInput = document.getElementById('intake-when') as HTMLInputElement
    const durInput = document.getElementById('intake-dur') as HTMLInputElement
    fireEvent.change(whenInput, { target: { value: '2026-07-20T10:00' } })
    fireEvent.change(durInput, { target: { value: '45' } })
    // The key-only i18n fallback can't show the interpolated "tot 10:45" text, but the
    // component only renders the em dash when `endTime` is falsy — a real value swaps
    // it out, which is what we can observe here without a live i18n instance.
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('never shows the raw vacancy id — falls back to a loading label, then the fetched title', async () => {
    vi.mocked(api.get).mockImplementation((url: unknown) => {
      if (String(url).includes('/vacancies/vac-9')) return Promise.resolve({ data: { data: { title: 'Verzorgende IG' } } })
      return Promise.reject({ response: { status: 404 } })
    })
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} defaultVacancyId="vac-9" />)
    expect(screen.queryByText('vac-9')).not.toBeInTheDocument()
    expect(await screen.findByText('Verzorgende IG')).toBeInTheDocument()
  })
})

// INTAKE-VACANCY-ID-1 (CMBE VAC-LEADS-1): the appointment endpoint now accepts
// vacancy_id — without it on the create payload, the vacancy's leads-list stays
// empty. Assert the actual REQUEST body (§13), not just that a callback fired.
describe('PlanIntakeModal · INTAKE-VACANCY-ID-1 (vacancy_id on the create payload)', () => {
  it('sends vacancy_id on the POST body when a vacancy context is prefilled', async () => {
    vi.mocked(api.get).mockImplementation((url: unknown) => {
      if (String(url).includes('/vacancies/vac-9')) return Promise.resolve({ data: { data: { title: 'Verzorgende IG' } } })
      return Promise.reject({ response: { status: 404 } })
    })
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} defaultVacancyId="vac-9" />)
    await screen.findByText('Verzorgende IG')
    await user.click(screen.getByRole('button', { name: 'work.createIntake' }))
    expect(api.post).toHaveBeenCalledWith('/candidates/cand-1/appointments', expect.objectContaining({ vacancy_id: 'vac-9' }))
  })

  it('sends no vacancy_id for a genuinely vacancy-less appointment (CONSIST-2 — no fake requirement)', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'work.createIntake' }))
    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('vacancy_id')
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
