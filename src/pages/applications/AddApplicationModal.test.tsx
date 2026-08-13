/**
 * AddApplicationModal — covers S2 (Danny): the widened 720px two-column panel
 * (mirrors MatchModal) with comfortable candidate/vacancy/owner pickers.
 * Layout/CSS is not asserted pixel-by-pixel (implementation detail); this checks
 * the panel actually renders wider than the old 440px modal and that all pickers
 * are the shared searchable CreatableSelect/SearchSelect components, never a bare
 * `<select>` (the tenant custom-field "Extra" section's own `<select>`s, when
 * present, are asserted explicitly by their own tests — see the W30 block below).
 *
 * V17 ("+ Sollicitant passes the phase"): the modal now also carries a start-stage
 * picker and POSTs `application_stage_id`. These tests assert the REQUEST — the
 * exact body — because that is the seam that was dead: the old POST sent
 * candidate/vacancy/owner only, so a recruiter adding an applicant from a vacancy
 * could never say which stage they enter at.
 *
 * W30 (2026-08): the candidate/vacancy pickers moved from a single 100-row
 * client-filtered CreatableSelect fetch to a server-searched SearchSelect (debounced
 * `search` GET param, mirrors tasks/drawer/LinksTab's identical picker) — covered by
 * the "server-side search" block. The create POST also gained `custom_fields` (the
 * tenant's active application custom-field defs, StoreApplicationRequest DOES accept
 * this field) — covered by the "custom fields (Extra section)" block.
 *
 * CMBE 5961c673 (superseding the earlier W30 note): StoreApplicationRequest NOW
 * accepts an optional `source` (verified against the backend request class), so a
 * free-text field was added (no tenant-CRUD lookup exists for this axis anywhere in
 * the app — mirrors the drawer's own Bron `<input>`) — covered by the "source" block
 * below. `application_stage_id`'s pre-existing omit-when-empty tests (untouched) also
 * double as regression coverage that `source` stays absent from those same bodies.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddApplicationModal from './AddApplicationModal'
import api from '@/lib/api'
import { useActionRulePreflight } from '@/components/actionrules'

// AXIS-1: only the network hook is stubbed, mirroring the candidate-drawer
// variant's own test — the real ActionRuleBanner still renders.
vi.mock('@/components/actionrules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/actionrules')>()),
  useActionRulePreflight: vi.fn(() => ({ decision: null, loading: false, error: false })),
}))

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

// W30: the tenant's active application custom-field defs — empty by default (no
// Extra section) so the pre-existing tests stay untouched; individual tests below
// swap this in to cover the section's render + POST-body wiring.
const customFieldsState = vi.hoisted(() => ({
  fields: [] as Array<{ key: string; label: string; type: string; options?: string[] }>,
}))

// APP-OWNER-1: mutable candidate/vacancy rows (each can carry an `owner`, mirroring
// CandidateListResource/VacancyListResource) so the derivation-chain tests below can
// vary who owns what per test; `lockedVacancyOwner` feeds the separate GET
// /vacancies/{id} fetch the LOCKED path uses (it never loads the `/vacancies` list).
const rowState = vi.hoisted(() => ({
  candidates: [{ id: 'c1', name: 'Anna Kandidaat' }] as Array<{ id: string; name: string; owner?: { id: string; name: string } | null }>,
  vacancies: [{ id: 'v1', title: 'Verzorgende IG', client_name: 'Zorggroep A' }] as Array<{ id: string; title: string; client_name?: string; owner?: { id: string; name: string } | null }>,
  lockedVacancyOwner: null as { id: string; name: string } | null,
}))

vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [
  { id: 'u1', name: 'Piet Recruiter' }, { id: 'u2', name: 'Klaas Anders' }, { id: 'u3', name: 'Anna Derde' },
] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Piet Recruiter' } }) }))
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ funnelTypes: [] }) }))
vi.mock('@/hooks/useApplicationStages', () => ({
  useApplicationStages: () => ({
    stages: stageState.stages,
    defaultStage: stageState.stages.find(s => s.is_default) ?? stageState.stages[0],
  }),
}))
// W30: mocked directly (rather than exercising the real fetch+tenant-cache hook)
// so a test can set the active defs without wiring the tenant-id plumbing that
// hook's own module-scope cache needs — mirrors the useApplicationStages mock above.
vi.mock('@/lib/useCustomFields', () => ({
  useCustomFields: () => ({ fields: customFieldsState.fields, allFields: customFieldsState.fields, loading: false, invalidate: vi.fn() }),
}))
vi.mock('@/lib/api', () => ({
  default: {
    // Per-URL option rows so the candidate/vacancy pickers have something to pick;
    // /vacancies/{id} (the LOCKED path's own recruiter fetch) resolves from
    // rowState.lockedVacancyOwner, decoupled from the picker list above. Params are
    // ignored here (every row always comes back) — the search/debounce tests assert
    // the CALL ARGS directly instead of filtering server-side in the mock.
    get: vi.fn((url: string) => {
      if (url === '/candidates') return Promise.resolve({ data: { data: rowState.candidates } })
      if (url === '/vacancies') return Promise.resolve({ data: { data: rowState.vacancies } })
      if (url.startsWith('/vacancies/')) return Promise.resolve({ data: { data: { owner: rowState.lockedVacancyOwner } } })
      return Promise.resolve({ data: { data: [] } })
    }),
    post: vi.fn(() => Promise.resolve({ data: { data: { id: 'a1' } } })),
  },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
  unwrapList: (res: { data?: { data?: unknown[] } }) =>
    ({ rows: res?.data?.data ?? [], total: 0, page: 1, lastPage: 1, perPage: 0 }),
}))

// Restore the default (real, uuid-id) stage lookup + owner-less rows before every test.
beforeEach(() => {
  vi.mocked(api.post).mockClear()
  vi.mocked(api.get).mockClear()
  stageState.stages = [
    { id: APPLIED, value: 'applied', label: 'Gesolliciteerd', is_default: true },
    { id: INVITED, value: 'invited', label: 'Uitgenodigd/Intake', is_default: false },
  ]
  customFieldsState.fields = []
  rowState.candidates = [{ id: 'c1', name: 'Anna Kandidaat' }]
  rowState.vacancies = [{ id: 'v1', title: 'Verzorgende IG', client_name: 'Zorggroep A' }]
  rowState.lockedVacancyOwner = null
  vi.mocked(useActionRulePreflight).mockReturnValue({ decision: null, loading: false, error: false })
})

// Pick candidate + vacancy through the real search popovers (W30: SearchSelect,
// same trigger/option accessible-name contract the old CreatableSelect pickers had).
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

  it('renders candidate/vacancy/owner/phase as searchable pickers, never a bare <select>', () => {
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.getByText('add.candidate')).toBeInTheDocument()
    expect(screen.getByText('add.vacancy')).toBeInTheDocument()
    expect(screen.getByText('add.owner')).toBeInTheDocument()
    expect(screen.getByText('add.phase')).toBeInTheDocument()
    // No tenant custom fields in this test (customFieldsState.fields === []), so no
    // Extra section — and therefore no bare native <select> anywhere on the form.
    expect(document.querySelector('select')).toBeNull()
    // Four picker toggle buttons (candidate/vacancy = SearchSelect, owner/phase =
    // CreatableSelect) — the owner one already shows the pre-selected logged-in
    // user's name (APP-OWNER-1 default).
    expect(screen.getByText('Piet Recruiter')).toBeInTheDocument()
    // 4 picker triggers (candidate/vacancy/owner/phase) + 2 VAC-CLEAR-1 clear crosses
    // (owner + phase — CLEAR-SWEEP 13-08: both start out pre-seeded, so their clear
    // cross is already visible on first render, unlike candidate/vacancy which start empty).
    expect(document.querySelectorAll('button[type="button"]').length).toBe(6)
  })

  it('shows the vacancy as a locked, non-editable display when opened from a vacancy', () => {
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} lockedVacancy={{ id: 'v1', title: 'Verpleegkundige', client: 'Yesway' }} />)
    expect(screen.getByText('Verpleegkundige · Yesway')).toBeInTheDocument()
    // Locked vacancy: 3 picker triggers (candidate + owner + phase) + 2 clear crosses
    // (owner + phase, both pre-seeded — see CLEAR-SWEEP note above).
    expect(document.querySelectorAll('button[type="button"]').length).toBe(5)
  })

  // CLEAR-SWEEP (Danny 13-08, "eenmaal gekozen blijft hij staan"): owner and start
  // stage are both optional (owner_id sent as null, application_stage_id omitted when
  // empty — see AddApplicationModal's `create`) — once auto-seeded, both must be
  // releasable back to "let the server decide" via the VAC-CLEAR-1 cross.
  it('clears the auto-seeded owner and default phase back to unset', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    const clears = await screen.findAllByTitle(/clearField/i)
    expect(clears).toHaveLength(2)
    await user.click(clears[0])
    await user.click((await screen.findAllByTitle(/clearField/i))[0])
    expect(screen.getByText('add.ownerPlaceholder')).toBeInTheDocument()
    expect(screen.getByText('add.phasePlaceholder')).toBeInTheDocument()
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

describe('AddApplicationModal · APP-OWNER-1 recruiter derivation chain', () => {
  it('the picked vacancy\'s recruiter wins over the picked candidate\'s owner', async () => {
    rowState.candidates = [{ id: 'c1', name: 'Anna Kandidaat', owner: { id: 'u2', name: 'Klaas Anders' } }]
    rowState.vacancies = [{ id: 'v1', title: 'Verzorgende IG', client_name: 'Zorggroep A', owner: { id: 'u3', name: 'Anna Derde' } }]
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await pickCandidateAndVacancy(user)

    // The vacancy's own recruiter (u3) wins over the candidate's own owner (u2).
    expect(screen.getByRole('button', { name: /Anna Derde/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'add.create' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/applications', expect.objectContaining({ owner_id: 'u3' })))
  })

  it('falls back to the candidate owner, then further to the logged-in user', async () => {
    rowState.candidates = [{ id: 'c1', name: 'Anna Kandidaat', owner: { id: 'u2', name: 'Klaas Anders' } }]
    const user = userEvent.setup()
    const { unmount } = render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)

    // Pick only the candidate (no vacancy) -> its own owner wins.
    await user.click(screen.getByRole('button', { name: /add\.candidatePlaceholder/ }))
    await user.click(await screen.findByRole('button', { name: 'Anna Kandidaat' }))
    expect(screen.getByRole('button', { name: /Klaas Anders/ })).toBeInTheDocument()
    unmount()

    // Neither a candidate owner nor a vacancy known -> falls back to the logged-in user.
    rowState.candidates = [{ id: 'c1', name: 'Anna Kandidaat' }]
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Piet Recruiter/ })).toBeInTheDocument()
  })

  it('a manual pick survives a later vacancy pick', async () => {
    rowState.candidates = [{ id: 'c1', name: 'Anna Kandidaat', owner: { id: 'u2', name: 'Klaas Anders' } }]
    rowState.vacancies = [{ id: 'v1', title: 'Verzorgende IG', client_name: 'Zorggroep A', owner: { id: 'u3', name: 'Anna Derde' } }]
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)

    // Pick the candidate first (auto-seeds to u2), then manually override the owner.
    await user.click(screen.getByRole('button', { name: /add\.candidatePlaceholder/ }))
    await user.click(await screen.findByRole('button', { name: 'Anna Kandidaat' }))
    await user.click(screen.getByRole('button', { name: /Klaas Anders/ }))
    await user.click(await screen.findByRole('button', { name: 'Piet Recruiter' }))

    // Picking the vacancy afterwards must NOT reseed the manual pick, even though
    // the vacancy's own recruiter (u3) would otherwise outrank it.
    await user.click(screen.getByRole('button', { name: /add\.vacancyPlaceholder/ }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))
    expect(screen.getByRole('button', { name: /Piet Recruiter/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'add.create' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/applications', expect.objectContaining({ owner_id: 'u1' })))
  })

  it('the LOCKED vacancy path fetches its own recruiter, which still wins over the candidate owner', async () => {
    rowState.candidates = [{ id: 'c1', name: 'Anna Kandidaat', owner: { id: 'u2', name: 'Klaas Anders' } }]
    rowState.lockedVacancyOwner = { id: 'u3', name: 'Anna Derde' }
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} lockedVacancy={{ id: 'v1', title: 'Verpleegkundige', client: 'Yesway' }} />)

    await user.click(screen.getByRole('button', { name: /add\.candidatePlaceholder/ }))
    await user.click(await screen.findByRole('button', { name: 'Anna Kandidaat' }))

    await waitFor(() => expect(screen.getByRole('button', { name: /Anna Derde/ })).toBeInTheDocument())
  })
})

describe('AddApplicationModal · W30 server-side search (candidate/vacancy pickers)', () => {
  it('loads an initial page via /candidates?search=&per_page=25 on mount (never the old per_page:100 dump)', async () => {
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates', { params: { per_page: 25 } }))
  })

  it('skips the /vacancies fetch entirely while locked (data minimisation)', () => {
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} lockedVacancy={{ id: 'v1', title: 'Verpleegkundige', client: 'Yesway' }} />)
    expect(vi.mocked(api.get).mock.calls.some(c => c[0] === '/vacancies')).toBe(false)
  })

  it('debounces the candidate search box into ONE server round-trip carrying the typed `search` param', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    // Let the initial mount fetch settle before measuring the delta below.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates', { params: { per_page: 25 } }))
    const before = vi.mocked(api.get).mock.calls.filter(c => c[0] === '/candidates').length

    await user.click(screen.getByRole('button', { name: /add\.candidatePlaceholder/ }))
    const searchBox = await screen.findByPlaceholderText('search')
    await user.type(searchBox, 'ann')

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates', { params: { search: 'ann', per_page: 25 } }))
    // SearchSelect's own 250ms debounce collapses the 3 keystrokes into ONE request,
    // never one GET per character typed.
    const after = vi.mocked(api.get).mock.calls.filter(c => c[0] === '/candidates').length
    expect(after - before).toBe(1)
  })

  it('debounces the vacancy search box the same way, on its own endpoint', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/vacancies', { params: { per_page: 25 } }))
    const before = vi.mocked(api.get).mock.calls.filter(c => c[0] === '/vacancies').length

    await user.click(screen.getByRole('button', { name: /add\.vacancyPlaceholder/ }))
    const searchBox = await screen.findByPlaceholderText('search')
    await user.type(searchBox, 'zorg')

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/vacancies', { params: { search: 'zorg', per_page: 25 } }))
    const after = vi.mocked(api.get).mock.calls.filter(c => c[0] === '/vacancies').length
    expect(after - before).toBe(1)
  })

  it('keeps the picked candidate\'s label + owner-chain data after a later search replaces the option list', async () => {
    rowState.candidates = [{ id: 'c1', name: 'Anna Kandidaat', owner: { id: 'u2', name: 'Klaas Anders' } }]
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /add\.candidatePlaceholder/ }))
    await user.click(await screen.findByRole('button', { name: 'Anna Kandidaat' }))
    // Owner auto-seeded from the picked candidate's own owner.
    expect(screen.getByRole('button', { name: /Klaas Anders/ })).toBeInTheDocument()

    // A later search that returns a DIFFERENT set of rows (Anna no longer in it)
    // must not blank the trigger label or drop the owner-derivation data already
    // captured at pick time (W30: pickedCandidate is its own state, not a live
    // lookup back into the just-replaced search results).
    rowState.candidates = [{ id: 'c2', name: 'Bram Anders' }]
    await user.click(screen.getByRole('button', { name: /add\.vacancyPlaceholder/ }))
    const vacancySearchBox = await screen.findByPlaceholderText('search')
    await user.type(vacancySearchBox, 'x')
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/vacancies', { params: { search: 'x', per_page: 25 } }))

    expect(screen.getByRole('button', { name: /Anna Kandidaat/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Klaas Anders/ })).toBeInTheDocument()
  })
})

describe('AddApplicationModal · W30 custom fields (Extra section)', () => {
  it('renders no Extra section and omits custom_fields from the POST when the tenant has no active application fields', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.queryByText('common:customFieldsCard.title')).not.toBeInTheDocument()

    await pickCandidateAndVacancy(user)
    await user.click(screen.getByRole('button', { name: 'add.create' }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('custom_fields')
  })

  it('renders the Extra section once ≥1 active application custom field exists, and POSTs the filled values', async () => {
    customFieldsState.fields = [
      { key: 'campaign', label: 'Campaign', type: 'text' },
      { key: 'vip', label: 'VIP lead', type: 'boolean' },
    ]
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.getByText('common:customFieldsCard.title')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Campaign'), 'Referral')
    await user.click(screen.getByLabelText('VIP lead'))

    await pickCandidateAndVacancy(user)
    await user.click(screen.getByRole('button', { name: 'add.create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/applications', expect.objectContaining({
      custom_fields: { campaign: 'Referral', vip: true },
    })))
  })

  it('never renders a bare <select>, even for a select-type custom field — it gets the searchable combobox instead', () => {
    customFieldsState.fields = [
      { key: 'campaign', label: 'Campaign', type: 'text' },
      { key: 'channel', label: 'Channel', type: 'select', options: ['Indeed', 'LinkedIn'] },
    ]
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    // Danny 08-08 (§4): searchable dropdown everywhere, no bare native <select> —
    // the select-type custom field now renders through the shared CreatableSelect.
    expect(document.querySelectorAll('select').length).toBe(0)
    const trigger = screen.getByLabelText(/Channel/)
    expect(trigger.tagName).toBe('BUTTON')
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
  })
})

describe('AddApplicationModal · AXIS-1 action-rule preflight', () => {
  it('renders no banner while the decision is allow/loading', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={() => {}} onCreated={() => {}} />)
    await pickCandidateAndVacancy(user)
    expect(screen.queryByTestId('action-rule-banner')).not.toBeInTheDocument()
  })

  it('warn: shows the banner but leaves Create enabled', async () => {
    vi.mocked(useActionRulePreflight).mockReturnValue({
      decision: { effect: 'warn', popup_code: 'P1', message: 'Anna is tijdelijk niet inzetbaar.' }, loading: false, error: false,
    })
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={() => {}} onCreated={() => {}} />)
    await pickCandidateAndVacancy(user)

    const banner = screen.getByTestId('action-rule-banner')
    expect(banner).toHaveAttribute('data-effect', 'warn')
    expect(screen.getByText('Anna is tijdelijk niet inzetbaar.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'add.create' })).toBeEnabled()
  })

  it('block: shows the banner and disables Create even with candidate + vacancy picked', async () => {
    vi.mocked(useActionRulePreflight).mockReturnValue({
      decision: { effect: 'block', popup_code: 'P3', message: 'Anna staat op de blacklist.' }, loading: false, error: false,
    })
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={() => {}} onCreated={() => {}} />)
    await pickCandidateAndVacancy(user)

    expect(screen.getByTestId('action-rule-banner')).toHaveAttribute('data-effect', 'block')
    expect(screen.getByRole('button', { name: 'add.create' })).toBeDisabled()
    // Even a direct call must not slip through — the hook name/params are the request.
    expect(useActionRulePreflight).toHaveBeenCalledWith('application.create', { candidateId: 'c1' })
    await user.click(screen.getByRole('button', { name: 'add.create' }))
    expect(api.post).not.toHaveBeenCalled()
  })
})

describe('AddApplicationModal · source (CMBE 5961c673)', () => {
  it('renders a free-text source field (no picker — no tenant lookup backs this axis)', () => {
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    const sourceInput = screen.getByLabelText('drawer.source')
    expect(sourceInput.tagName).toBe('INPUT')
    expect(sourceInput).toHaveAttribute('maxlength', '64')
  })

  it('POSTs the typed source, trimmed', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await user.type(screen.getByLabelText('drawer.source'), '  Website  ')
    await pickCandidateAndVacancy(user)
    await user.click(screen.getByRole('button', { name: 'add.create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/applications', expect.objectContaining({
      source: 'Website',
    })))
  })

  it('omits source from the POST body when left empty (mirrors application_stage_id)', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await pickCandidateAndVacancy(user)
    await user.click(screen.getByRole('button', { name: 'add.create' }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('source')
  })

  it('omits a whitespace-only source from the POST body', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await user.type(screen.getByLabelText('drawer.source'), '   ')
    await pickCandidateAndVacancy(user)
    await user.click(screen.getByRole('button', { name: 'add.create' }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('source')
  })
})
