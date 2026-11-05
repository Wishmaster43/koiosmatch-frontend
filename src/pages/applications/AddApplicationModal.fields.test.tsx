/** AddApplicationModal · source, required fields and aria-required pickers (split from AddApplicationModal.test.tsx). */
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

describe('AddApplicationModal · source (S-SOURCE-1, supersedes CMBE 5961c673)', () => {
  // S-SOURCE-1: the free-text `<input>` became a searchable/creatable CreatableSelect
  // (see useApplicationSources' doc comment for why the backend has no tenant-CRUD
  // lookup behind it yet) — never a bare native <select>, and never a plain <input>.
  // The trigger's own accessible-name span mirrors the field label's text while
  // unset (placeholder === label copy), so every lookup below scopes to the
  // BUTTON role explicitly rather than a bare getByText (ambiguous: label + span).
  it('renders source as a searchable, clearable picker (never a bare <input> or <select>)', async () => {
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(document.querySelector('select')).toBeNull()
    expect(document.querySelector('input[maxlength]')).toBeNull()
    const trigger = screen.getAllByRole('button', { name: /drawer\.source/ })[0]
    await userEvent.setup().click(trigger)
    expect(screen.getByPlaceholderText('drawer.source')).toBeInTheDocument()
  })

  it('POSTs a source picked from the searchable list', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await user.click(screen.getAllByRole('button', { name: /drawer\.source/ })[0])
    await user.click(screen.getByRole('button', { name: 'Indeed' }))
    await pickCandidateAndVacancy(user)
    await user.click(screen.getByRole('button', { name: 'add.create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/applications', expect.objectContaining({
      source: 'Indeed',
    })))
  })

  it('POSTs a newly typed source (free entry — no tenant lookup blocks an unseen value), trimmed', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await user.click(screen.getAllByRole('button', { name: /drawer\.source/ })[0])
    await user.type(screen.getByPlaceholderText('drawer.source'), '  Website  ')
    await user.click(await screen.findByRole('button', { name: /Website/ }))
    await pickCandidateAndVacancy(user)
    await user.click(screen.getByRole('button', { name: 'add.create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/applications', expect.objectContaining({
      source: 'Website',
    })))
  })

  it('picks then clears the source picker back to unset (optional field, VAC-CLEAR-1)', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await user.click(screen.getAllByRole('button', { name: /drawer\.source/ })[0])
    await user.click(screen.getByRole('button', { name: 'Indeed' }))
    // The trigger's accessible name is label-driven (aria-labelledby self-reference),
    // so it stays "drawer.source" after picking — assert the pick via its VISIBLE
    // text instead (mirrors the existing owner-picker test's screen.getByText use),
    // then scope the clear button to that same trigger.
    const sourceValueText = screen.getByText('Indeed')
    const sourceClear = sourceValueText.closest('div')!.querySelector('button[title="clearField"]') as HTMLButtonElement
    expect(sourceClear).toBeTruthy()
    await user.click(sourceClear)
    await pickCandidateAndVacancy(user)
    await user.click(screen.getByRole('button', { name: 'add.create' }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('source')
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

  // Register PDF-SOLLICITATIES-2026-08-14, pt.1: same-name candidates must be
  // tellable apart in the picker — function title + city fold into the option label.
  it('shows function title and city in the candidate picker so same-name rows are distinguishable', async () => {
    rowState.candidates = [
      { id: 'c1', name: 'Jan Blom', function_title: 'Verpleegkundige', city: 'Utrecht' } as never,
      { id: 'c2', name: 'Jan Blom', function_title: 'Verzorgende', city: 'Rotterdam' } as never,
    ]
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /add\.candidatePlaceholder/ }))
    expect(await screen.findByRole('button', { name: 'Jan Blom · Verpleegkundige · Utrecht' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jan Blom · Verzorgende · Rotterdam' })).toBeInTheDocument()
  })

  // pt.2: vacancy is genuinely optional — an application must be creatable (and
  // POSTed) with a candidate only, and the field must read as optional.
  it('marks the vacancy field optional and allows creating without picking one', async () => {
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={onCreated} />)
    expect(screen.getByText('add.vacancyOptional')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /add\.candidatePlaceholder/ }))
    await user.click(await screen.findByRole('button', { name: 'Anna Kandidaat' }))
    const createBtn = screen.getByRole('button', { name: 'add.create' })
    expect(createBtn).toBeEnabled()
    await user.click(createBtn)
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/applications', expect.objectContaining({
      candidate_id: 'c1', vacancy_id: null,
    })))
    expect(onCreated).toHaveBeenCalled()
  })

  // pt.4: a new candidate can be created from this popup, reusing the real
  // AddCandidateModal — and the freshly created candidate is picked straight in.
  it('opens the real AddCandidateModal from "+ New candidate" and picks the freshly created candidate', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /add\.newCandidate/ }))
    expect(screen.getByText('mock-create-candidate')).toBeInTheDocument()
    await user.click(screen.getByText('mock-create-candidate'))
    // The stubbed AddCandidateModal closes and the candidate picker now shows
    // the created candidate (name · function · city), submittable straight away.
    expect(screen.queryByText('mock-create-candidate')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nieuwe Kandidaat · Verpleegkundige · Utrecht/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'add.create' })).toBeEnabled()
  })
})

// The required-marker asterisk is a sibling <span>, so the label text is split
// across two DOM nodes — RTL's default getByText only reads a node's OWN direct
// text and ignores nested elements ("text broken up by multiple elements"), so a
// plain string/regex query can't see the combined "label*" text. This scoped
// function matcher checks the full textContent (label + marker) of ONE element
// exactly, which only the label's own wrapping element can match.
const exactText = (text: string) => (_content: string, el: Element | null) => el?.textContent === text

/**
 * APP-REQUIRED-FE-1 (Danny: "hoe zorg ik dat BRON bij nieuwe sollicitatie
 * verplicht is? moet bij instellingen komen") — the tenant `application_required_
 * fields` setting (flat array, no phase axis). §13: the block/allow assertions
 * check the REQUEST (api.post called or not), never only a callback.
 */
describe('AddApplicationModal · APP-REQUIRED-FE-1 (tenant-configurable required fields)', () => {
  it('with the setting absent, nothing extra is required — Create submits without a source', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await pickCandidateAndVacancy(user)
    await user.click(screen.getByRole('button', { name: 'add.create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('source')
  })

  it('marks Bron required (asterisk) and blocks an empty submit client-side, without calling the server', async () => {
    settingsRef.current = { application_required_fields: JSON.stringify(['source']) }
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)

    expect(screen.getByText(exactText('drawer.source*'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /add\.candidatePlaceholder/ }))
    await user.click(await screen.findByRole('button', { name: 'Anna Kandidaat' }))
    await user.click(screen.getByRole('button', { name: 'add.create' }))

    expect(api.post).not.toHaveBeenCalled()
    expect(screen.getByText('common:errors.fieldRequired')).toBeInTheDocument()
  })

  it('lets the recruiter proceed once the required source is picked', async () => {
    settingsRef.current = { application_required_fields: ['source'] }
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /drawer\.source/ }))
    await user.click(screen.getByRole('button', { name: 'Indeed' }))
    await pickCandidateAndVacancy(user)
    await user.click(screen.getByRole('button', { name: 'add.create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/applications', expect.objectContaining({
      source: 'Indeed',
    })))
  })

  it('maps a source 422 onto the picker border — existing path, unaffected by the required feature', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { data: { message: 'Ongeldige gegevens.', errors: { source: ['ongeldige bron'] } } },
    })
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await pickCandidateAndVacancy(user)
    await user.click(screen.getByRole('button', { name: 'add.create' }))

    const sourceTrigger = await screen.findByRole('button', { name: /drawer\.source/ })
    await waitFor(() => expect(sourceTrigger.getAttribute('style')).toContain('var(--color-danger)'))
  })

  it('marks Vacature/Recruiter/Fase required too, each from the same flat array', () => {
    settingsRef.current = { application_required_fields: ['vacancy_id', 'owner_id', 'application_stage_id'] }
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)

    expect(screen.getByText(exactText('add.vacancy*'))).toBeInTheDocument()
    expect(screen.getByText(exactText('add.owner*'))).toBeInTheDocument()
    expect(screen.getByText(exactText('add.phase*'))).toBeInTheDocument()
    // The honest "(optioneel)" hint is gone once the tenant requires the vacancy.
    expect(screen.queryByText('add.vacancyOptional')).not.toBeInTheDocument()
  })

  it('blocks Create when a required vacancy is missing, without touching the server', async () => {
    settingsRef.current = { application_required_fields: ['vacancy_id'] }
    const user = userEvent.setup()
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /add\.candidatePlaceholder/ }))
    await user.click(await screen.findByRole('button', { name: 'Anna Kandidaat' }))
    await user.click(screen.getByRole('button', { name: 'add.create' }))

    expect(api.post).not.toHaveBeenCalled()
    expect(screen.getByText('common:errors.fieldRequired')).toBeInTheDocument()
  })
})

// REQUIRED-A11Y-4: the asterisk-only markers (requiredMark) never reached
// assistive tech — this pins aria-required on the real triggers.
describe('AddApplicationModal · REQUIRED-A11Y-4 (aria-required on pickers)', () => {
  it('always marks the candidate trigger aria-required (candidate is unconditionally required)', () => {
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.getByRole('button', { name: /add\.candidatePlaceholder/ })).toHaveAttribute('aria-required', 'true')
  })

  it('leaves the vacancy trigger without aria-required when the tenant setting omits vacancy_id', () => {
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.getByRole('button', { name: /add\.vacancyPlaceholder/ })).not.toHaveAttribute('aria-required')
  })

  it('marks the vacancy trigger aria-required once the tenant setting lists vacancy_id', () => {
    settingsRef.current = { application_required_fields: ['vacancy_id'] }
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.getByRole('button', { name: /add\.vacancyPlaceholder/ })).toHaveAttribute('aria-required', 'true')
  })
})
