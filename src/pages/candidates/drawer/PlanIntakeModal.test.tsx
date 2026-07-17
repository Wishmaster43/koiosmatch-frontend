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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanIntakeModal from './PlanIntakeModal'
import api from '@/lib/api'

vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Piet Recruiter' }] }) }))
vi.mock('@/lib/useAppointmentTypes', () => ({
  useAppointmentTypes: () => ({
    types: [{ value: 'intake_flex', label: 'Intake Flex', default_duration_min: 30, default_modality: 'office', is_intake: true }],
    intakeTypes: [{ value: 'intake_flex', label: 'Intake Flex', default_duration_min: 30, default_modality: 'office', is_intake: true }],
    metaOf: () => ({ default_duration_min: 30, default_modality: 'office' }),
  }),
}))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [] }))
vi.mock('../hooks/useVacancyOptions', () => ({ useVacancyOptions: () => [] }))
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
