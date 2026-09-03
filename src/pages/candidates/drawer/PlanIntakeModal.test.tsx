/**
 * PlanIntakeModal — regression test for the 422 field mapping (mirrors the house
 * pattern in AddCandidateModal/AddCustomerModal, see MatchModal.test.tsx):
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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanIntakeModal, { endTimeOf } from './PlanIntakeModal'
import api from '@/lib/api'
import { useActionRulePreflight } from '@/components/actionrules'
import { useAppointmentTypes } from '@/lib/useAppointmentTypes'
// Reused so per-test fixtures (incl. an empty-types shape the hook's own typing
// doesn't perfectly model) don't fight TS literal-widening on `default_modality`.
type AppointmentTypesResult = ReturnType<typeof useAppointmentTypes>

// Two assignable users — 'u1' is the logged-in user (see the useAuth mock below),
// 'u2' is a DIFFERENT candidate owner, so RECRUITER-DEFAULT-1's priority (candidate
// owner over the logged-in-user fallback) is actually observable in the tests below.
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
  // fix, found by the MODALITY-PHONE-CLEAR-1 tests below): a test inside the
  // AXIS-MATRIX-2 describe block sets a persistent `mockReturnValue` (warn/block)
  // that otherwise LEAKS into every CREATE-mode test that runs after it in this
  // file — a leaked 'block' decision silently disables the submit button, so a
  // later test's click does nothing and its POST assertion sees zero calls.
  vi.mocked(useActionRulePreflight).mockReturnValue({ decision: null, loading: false, error: false })
})

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

// RECRUITER-DEFAULT-1 (Danny 05-08: "+ intake recruiter komt er niet standaard te
// staan"): the OLD effect only ever tried the logged-in-user fallback — the modal
// never received the candidate's own owner at all. The derivation chain is now
// candidate owner (when assignable) → logged-in user (when assignable) → empty,
// seeded once (never clobbers a manual pick).
describe('PlanIntakeModal · RECRUITER-DEFAULT-1 (candidate owner → logged-in user → manual pick)', () => {
  it('preselects the candidate owner over the logged-in user when both are assignable', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    // 'u2' (Els) is the candidate's own owner; 'u1' (Piet, the logged-in user per the
    // useAuth mock above) must lose the priority race.
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} candidateOwnerId="u2" />)
    expect(await screen.findByRole('button', { name: 'Els Recruiter' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'work.createIntake' }))
    expect(api.post).toHaveBeenCalledWith('/candidates/cand-1/appointments', expect.objectContaining({ owner_id: 'u2' }))
  })

  it('falls back to the logged-in user when the candidate has no owner', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(await screen.findByRole('button', { name: 'Piet Recruiter' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'work.createIntake' }))
    expect(api.post).toHaveBeenCalledWith('/candidates/cand-1/appointments', expect.objectContaining({ owner_id: 'u1' }))
  })

  it('a manual recruiter change survives the auto-seed', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    // Auto-seeds to the candidate owner ('u2'); the recruiter then manually picks 'u1' —
    // that pick, not the seed, must be what reaches the POST body.
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} candidateOwnerId="u2" />)
    await user.click(await screen.findByRole('button', { name: 'Els Recruiter' }))
    await user.click(await screen.findByRole('button', { name: 'Piet Recruiter' }))
    expect(await screen.findByRole('button', { name: 'Piet Recruiter' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'work.createIntake' }))
    expect(api.post).toHaveBeenCalledWith('/candidates/cand-1/appointments', expect.objectContaining({ owner_id: 'u1' }))
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
    expect(screen.getByRole('button', { name: /work\.modalityWhere/ })).toBeInTheDocument()
  })

  it('shows the SAME neutral location picker for a remote (video) appointment — BE only accepts configured lookup slugs, never free text', () => {
    vi.mocked(useAppointmentTypes).mockReturnValue(typeFixture('remote'))
    render(<PlanIntakeModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.getByText('work.modalityWhere')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /work\.modalityWhere/ })).toBeInTheDocument()
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
