/**
 * AddApplicationModal — covers S2 (Danny): the widened 720px two-column panel
 * (mirrors MatchPlacementModal) with comfortable candidate/vacancy/owner pickers.
 * Layout/CSS is not asserted pixel-by-pixel (implementation detail); this checks
 * the panel actually renders wider than the old 440px modal and that all pickers
 * are the shared searchable CreatableSelect, never a bare `<select>`.
 *
 * V17 ("+ Sollicitant passes the phase"): the modal now also carries a start-stage
 * picker and POSTs `application_stage_id`. These tests assert the REQUEST — the
 * exact body — because that is the seam that was dead: the old POST sent
 * candidate/vacancy/owner only, so a recruiter adding an applicant from a vacancy
 * could never say which stage they enter at.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddApplicationModal from './AddApplicationModal'
import api from '@/lib/api'

// Real (uuid) stage ids — anything else is unsubmittable per the backend rule
// (uuid|exists:application_stages,id) and the modal filters it out on purpose.
const APPLIED = '11111111-1111-4111-8111-111111111111'
const INVITED = '22222222-2222-4222-8222-222222222222'

// vi.hoisted so the mock factory below can read it (vi.mock is hoisted above imports).
const stageState = vi.hoisted(() => ({
  stages: [
    { id: '11111111-1111-4111-8111-111111111111', value: 'applied', label: 'Gesolliciteerd', is_default: true },
    { id: '22222222-2222-4222-8222-222222222222', value: 'invited', label: 'Uitgenodigd/Intake', is_default: false },
  ] as Array<{ id: string; value: string; label: string; is_default: boolean }>,
}))

vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Piet Recruiter' }] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Piet Recruiter' } }) }))
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ funnelTypes: [] }) }))
vi.mock('@/hooks/useApplicationStages', () => ({
  useApplicationStages: () => ({
    stages: stageState.stages,
    defaultStage: stageState.stages.find(s => s.is_default) ?? stageState.stages[0],
  }),
}))
vi.mock('@/lib/api', () => ({
  default: {
    // Per-URL option rows so the candidate/vacancy pickers have something to pick.
    get: vi.fn((url: string) => Promise.resolve({ data: { data:
      url === '/candidates' ? [{ id: 'c1', name: 'Anna Kandidaat' }]
        : url === '/vacancies' ? [{ id: 'v1', title: 'Verzorgende IG', client_name: 'Zorggroep A' }]
          : [] } })),
    post: vi.fn(() => Promise.resolve({ data: { data: { id: 'a1' } } })),
  },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
  unwrapList: (res: { data?: { data?: unknown[] } }) =>
    ({ rows: res?.data?.data ?? [], total: 0, page: 1, lastPage: 1, perPage: 0 }),
}))

// Restore the default (real, uuid-id) stage lookup before every test.
beforeEach(() => {
  vi.mocked(api.post).mockClear()
  stageState.stages = [
    { id: APPLIED, value: 'applied', label: 'Gesolliciteerd', is_default: true },
    { id: INVITED, value: 'invited', label: 'Uitgenodigd/Intake', is_default: false },
  ]
})

// Pick candidate + vacancy through the real CreatableSelect popovers.
async function pickCandidateAndVacancy(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /add\.candidatePlaceholder/ }))
  await user.click(await screen.findByRole('button', { name: 'Anna Kandidaat' }))
  await user.click(screen.getByRole('button', { name: /add\.vacancyPlaceholder/ }))
  await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))
}

describe('AddApplicationModal', () => {
  it('renders the widened 720px panel (not the old 440px width)', () => {
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    const panel = screen.getByRole('dialog')
    expect(panel).toHaveStyle({ width: '720px' })
  })

  it('renders candidate/vacancy/owner/phase as searchable CreatableSelect pickers, never a bare <select>', () => {
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.getByText('add.candidate')).toBeInTheDocument()
    expect(screen.getByText('add.vacancy')).toBeInTheDocument()
    expect(screen.getByText('add.owner')).toBeInTheDocument()
    expect(screen.getByText('add.phase')).toBeInTheDocument()
    expect(document.querySelector('select')).toBeNull()
    // Four CreatableSelect toggle buttons (one per picker) — the owner one already
    // shows the pre-selected logged-in user's name (APP-OWNER-1 default).
    expect(screen.getByText('Piet Recruiter')).toBeInTheDocument()
    expect(document.querySelectorAll('button[type="button"]').length).toBe(4)
  })

  it('shows the vacancy as a locked, non-editable display when opened from a vacancy', () => {
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} lockedVacancy={{ id: 'v1', title: 'Verpleegkundige', client: 'Yesway' }} />)
    expect(screen.getByText('Verpleegkundige · Yesway')).toBeInTheDocument()
    // Locked vacancy: 3 CreatableSelect pickers remain (candidate + owner + phase).
    expect(document.querySelectorAll('button[type="button"]').length).toBe(3)
  })
})

describe('AddApplicationModal · start stage (V17)', () => {
  it('proposes the tenant-flagged default stage, never a hardcoded one', () => {
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.getByRole('button', { name: /add\.phase Gesolliciteerd/ })).toBeInTheDocument()
  })

  it('POSTs the proposed default stage id with the application', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await pickCandidateAndVacancy(user)
    await user.click(screen.getByRole('button', { name: 'add.create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/applications', {
      candidate_id: 'c1', vacancy_id: 'v1', owner_id: 'u1', application_stage_id: APPLIED,
    }))
  })

  it('POSTs the stage the recruiter actually picked', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await pickCandidateAndVacancy(user)
    await user.click(screen.getByRole('button', { name: /add\.phase Gesolliciteerd/ }))
    await user.click(await screen.findByRole('button', { name: 'Uitgenodigd/Intake' }))
    await user.click(screen.getByRole('button', { name: 'add.create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/applications', {
      candidate_id: 'c1', vacancy_id: 'v1', owner_id: 'u1', application_stage_id: INVITED,
    }))
  })

  it('offers no picker and OMITS application_stage_id when the lookup has no submittable (uuid) stage', async () => {
    // The seed shape useApplicationStages falls back to before /application-stages
    // resolves: slug ids that would 422. Nothing is invented — the server decides.
    stageState.stages = [{ id: 'applied', value: 'applied', label: 'Gesolliciteerd', is_default: true }]
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.queryByText('add.phase')).not.toBeInTheDocument()

    await pickCandidateAndVacancy(user)
    await user.click(screen.getByRole('button', { name: 'add.create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/applications', {
      candidate_id: 'c1', vacancy_id: 'v1', owner_id: 'u1',
    }))
  })

  it('maps an application_stage_id 422 onto the phase picker (API_TO_FORM)', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { data: { message: 'De opgegeven gegevens zijn ongeldig.', errors: { application_stage_id: ['ongeldige fase'] } } },
    })
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await pickCandidateAndVacancy(user)
    await user.click(screen.getByRole('button', { name: 'add.create' }))

    const phasePicker = await screen.findByRole('button', { name: /add\.phase Gesolliciteerd/ })
    await waitFor(() => expect(phasePicker.getAttribute('style')).toContain('var(--color-danger)'))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
