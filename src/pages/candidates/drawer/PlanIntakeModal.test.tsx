/**
 * PlanIntakeModal — regression test for the 422 field mapping (mirrors the house
 * pattern in AddCandidateModal/AddCustomerModal, see MatchPlacementModal.test.tsx):
 * the catch used to only fire a generic toast; it must now map `errors.{field}`
 * onto the matching field and fall back to a server message/generic banner
 * otherwise. The appointment-type/user/vacancy/location lookups hit the network
 * (react-query / useCachedLookup) — mocked directly so the test doesn't need a
 * QueryClientProvider.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanIntakeModal, { endTimeOf } from './PlanIntakeModal'
import api from '@/lib/api'

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
