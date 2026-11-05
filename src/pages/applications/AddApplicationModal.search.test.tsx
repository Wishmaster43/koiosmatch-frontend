/** AddApplicationModal · server-side search, custom fields and action-rule preflight (split from AddApplicationModal.test.tsx). */
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
// APP-REQUIRED-FE-1: the tenant `application_required_fields` setting, controlled
// per test — mirrors the candidate-drawer variant's own settingsRef pattern.
// Absent (== {}) by default, matching "nothing extra required" everywhere above.
const settingsRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/settings/useAllSettings')>()),
  useAllSettings: () => settingsRef.current,
}))
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
// NEWCAND-1: stub the real create-candidate modal — its own extensive dependency
// tree (genders/locations/functions/provinces/…) is out of scope here; this test
// file only asserts the INTEGRATION seam (opening it, and what onCreated does).
// Mocks the BARREL flat (§2 barrel-besluit): only the one integration seam this
// file asserts — the real barrel would eagerly load all candidate internals.
vi.mock('@/pages/candidates/shared', () => ({
  AddCandidateModal: ({ onCreated, onClose }: { onCreated: (c: unknown) => void; onClose: () => void }) => (
    <div>
      <button onClick={() => onCreated({ id: 'c9', name: 'Nieuwe Kandidaat', title: 'Verpleegkundige', city: 'Utrecht', ownerId: 'u2', owner: 'Klaas Anders' })}>
        mock-create-candidate
      </button>
      <button onClick={onClose}>mock-close-candidate</button>
    </div>
  ),
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
      // S-SOURCE-1 GRADUATED 2026-08-14: useApplicationSources reads the real
      // /candidate-sources lookup. free_entry: true here simulates a tenant that
      // opted into creatable sources, so the "POSTs a newly typed source" test
      // below keeps exercising the create-a-new-value path regardless of the
      // hook's own strict-by-default fallback (covered on its own in
      // useApplicationSources.test.ts).
      // X-20 prep: the dropdown hook states ?active=1 explicitly; the bare path stays for the list editor.
      if (url === '/candidate-sources' || url === '/candidate-sources?active=1') return Promise.resolve({ data: { data: [], allow_free_entry: true } })
      return Promise.resolve({ data: { data: [] } })
    }),
    post: vi.fn(() => Promise.resolve({ data: { data: { id: 'a1' } } })),
  },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
  unwrapList: (res: { data?: { data?: unknown[] } }) =>
    ({ rows: res?.data?.data ?? [], total: 0, page: 1, lastPage: 1, perPage: 0 }),
  getActiveTenantId: () => 'tenant-1',
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
  settingsRef.current = {}
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

