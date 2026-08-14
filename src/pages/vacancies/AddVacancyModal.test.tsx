/**
 * AddVacancyModal — SLICE 1+2 (Danny's 22-point spec): the popup rebuild that
 * splits the form into `addmodal/` cards (Algemeen/Klant/Inzet/Functie-eisen/
 * Voorwaarden/Beschrijving/Matchprofiel/AI-agent/Publicatie/Recruiter), moves
 * status into a header pill row, replaces the old silent location/department
 * id-passthrough with a REAL cascade, and adds every field the backend already
 * accepts (measured against StoreVacancyRequest/VacancyWriter). Every new field
 * rides the POST body CONDITIONALLY (absent when empty) so the pre-SLICE-1
 * exact-body contract (title-only create) stays byte-identical — asserted below.
 * SLICE 2 adds the Matchprofiel/AI-agent/Publicatie bodies and the AI-agent/
 * attachments module+permission gating (own describe blocks near the bottom).
 *
 * Network-backed hooks are mocked directly (no QueryClient needed, mirrors
 * AddCandidateModal.test.tsx); i18next is uninitialised so t() returns raw keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddVacancyModal from './AddVacancyModal'

// useAddVacancyForm reuses composeAddress from useVacancyDetailsForm.ts, which
// (for the DRAWER's own date formatting) imports lib/datetime -> src/i18n's real
// instance -> react-i18next's initReactI18next — so the mock below must still
// export a usable stub for it, or that eager import chain throws at module load.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'nl' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

// Hoisted, mutable per-test lookup state — lets the "honest empty status" test
// override just the statuses list without redeclaring every mock.
const { lookupState } = vi.hoisted(() => ({
  lookupState: {
    statuses: [
      { value: 'open', label: 'Open', color: '#79B58E' },
      { value: 'closed', label: 'Closed', color: '#8A94A6' },
    ] as Array<{ value: string; label: string; color?: string }>,
    // SLICE 2: PublicationCard's channel list — empty by default so the
    // base-body tests never see a `published_channels` key (nothing to toggle).
    channels: [] as Array<{ value: string; label: string }>,
  },
}))
vi.mock('@/context/VacancyLookupsContext', () => ({
  useVacancyLookups: () => ({
    statuses: lookupState.statuses,
    seniorityLevels: [{ value: 'senior', label: 'Senior' }, { value: 'medior', label: 'Medior' }],
    educationLevels: [{ value: 'hbo', label: 'HBO' }],
    defaultSeniority: '', defaultEducation: '',
    channels: lookupState.channels,
  }),
}))
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ candidateTypes: [{ value: 'flex', label: 'Flex', color: '#6E8FD6' }, { value: 'zzp', label: 'ZZP', color: '#79B58E' }] }),
}))
vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: ['Zorg', 'IT'] }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG', 'Helpende'], allowFreeEntry: false }) }))
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'branch-1', label: 'Vestiging Noord' }, { value: 'branch-2', label: 'Vestiging Zuid' }],
}))
vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: ['Zuid-Holland', 'Utrecht'] }) }))
// The cascade fetch itself — stubbed so only useCascadePickers' own pick/reset
// logic is under test (no live fetch, mirrors useCascadePickers.test.tsx).
// V3-6: keyed by customer id (default empty per id) — the narrowing describe
// block below fills `cascadeState.byCustomer` per test so a customer SWITCH can
// be proven to actually change what the location/department pickers offer; every
// OTHER test keeps the previous always-empty behaviour untouched.
const { cascadeState } = vi.hoisted(() => ({
  cascadeState: {
    byCustomer: {} as Record<string, {
      locations: Array<{ id: string; name: string; departments?: Array<{ id: string; name: string }> }>
      contacts: Array<{ id: string; name: string }>
      // VAC-VESTIGING-1: the customer's own mirrored branch — feeds the create
      // form's branch-proposal prediction (useVacancyBranchDefault).
      branch_id?: string
    }>,
  },
}))
// A STABLE `detail` object per customer id (not a fresh literal every render) —
// the real hook only replaces its `detail` state once per resolved fetch, so a
// mock that hands out a new object identity on every render would fire any
// `useEffect([detail, ...])` reader on every render too (an infinite loop this
// exact mock shape once produced, VAC-VESTIGING-1).
const detailByCustomer = new Map<string, { branch_id: string | null } | null>()
vi.mock('@/hooks/useCustomerCascade', () => ({
  useCustomerCascade: (customerId: string) => {
    const data = cascadeState.byCustomer[customerId] ?? { locations: [], contacts: [] }
    if (!detailByCustomer.has(customerId)) {
      detailByCustomer.set(customerId, customerId ? { branch_id: data.branch_id ?? null } : null)
    }
    return { detail: detailByCustomer.get(customerId) ?? null, locations: data.locations, contacts: data.contacts, refetch: vi.fn() }
  },
}))
// Hoisted, mutable auth state — defaults to no module/no permission (both
// SLICE-2 gates stay closed), so the SLICE-1 base-body tests never see
// AiAgentCard/AttachmentsCard. Individual SLICE-2 tests flip these on.
const { authState } = vi.hoisted(() => ({
  authState: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the default mock grants neither; the param exists only to match hasModule's real signature
    hasModule: (_k: string): boolean => false,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the default mock grants neither; the param exists only to match hasPermission's real signature
    hasPermission: (_p: string): boolean => false,
  },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Piet Recruiter' }, hasModule: authState.hasModule, hasPermission: authState.hasPermission }),
}))
// SLICE 2's new query-backed hooks — mocked directly (no QueryClient in this
// tree, mirrors the file's own convention above) so the base-body/SLICE-1
// tests never touch the network.
// Hoisted, mutable template list — the Matchprofiel test needs one real
// template to prove picking it (vs. editing a slider) sends different bodies.
const { matchTemplatesState } = vi.hoisted(() => ({
  matchTemplatesState: { templates: [] as Array<{ id: string; name: string; weights: Record<string, number>; linkedVacanciesCount: number }> },
}))
vi.mock('./hooks/useMatchWeightTemplates', () => ({ useMatchWeightTemplates: () => ({ templates: matchTemplatesState.templates, loading: false, error: false }) }))
// Hoisted, mutable agent list — the gating test flips authState on and needs
// at least one real option to prove ai_agent_id rides the create body.
const { aiAgentsState } = vi.hoisted(() => ({
  aiAgentsState: { options: [] as Array<{ value: string; label: string }> },
}))
vi.mock('./hooks/useAiAgents', () => ({ useAiAgents: () => ({ options: aiAgentsState.options, agents: [], loading: false, error: false }) }))
// PublicationCard's tenant-default lookup — mocked so it never depends on the
// module-level useAllSettings cache/real `api.get('/settings')` round-trip
// (that hook's own cache is shared across test files by design, §9).
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getJsonSetting: (_values: unknown, _key: string, fallback: unknown) => fallback,
}))
vi.mock('./addmodal/useGenerateDescription', () => ({
  useGenerateDescription: () => ({
    open: false, openFlow: vi.fn(), closeFlow: vi.fn(), profile: null, resolving: false, resolveFailed: false,
    noProfileConfigured: false, status: 'idle', concept: '', generate: vi.fn(), discard: vi.fn(),
  }),
}))
// Hoisted, mutable post-create-attachments state — the sequencing-gate test
// flips `hasPending` on to prove the submit path decides whether to run it.
const { attachmentsState } = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the default no-op mock ignores it; the param exists only to match runSequence's real signature
  attachmentsState: { hasPending: false, runSequence: (async (_id: unknown) => {}) as (id: unknown) => Promise<void> },
}))
vi.mock('./addmodal/usePostCreateAttachments', () => ({
  usePostCreateAttachments: () => ({
    files: [], addFile: vi.fn(), removeFile: vi.fn(),
    noteText: '', setNoteText: vi.fn(), noteStatus: 'idle', noteError: '',
    running: false, hasPending: attachmentsState.hasPending, runSequence: attachmentsState.runSequence,
    retryFile: vi.fn(), retryNote: vi.fn(),
  }),
}))
// Tiptap needs a real browser to mount — stubbed with a plain controlled
// textarea (mirrors AddCandidateModal.test.tsx / AddLocationModal.test.tsx);
// CollapsibleRichText itself runs for real around it.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="rich-text-editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))

const mockPost = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: (...args: unknown[]) => mockPost(...args), patch: vi.fn(), delete: vi.fn() } }
})

const users = [{ id: 'u1', name: 'Piet Recruiter' }]
const customers = [{ id: 'c1', name: 'Rivas Zorggroep' }, { id: 'c2', name: 'Yesway Zorg' }]
const noop = () => {}

beforeEach(() => {
  detailByCustomer.clear()
  lookupState.statuses = [
    { value: 'open', label: 'Open', color: '#79B58E' },
    { value: 'closed', label: 'Closed', color: '#8A94A6' },
  ]
  lookupState.channels = []
  authState.hasModule = () => false
  authState.hasPermission = () => false
  aiAgentsState.options = []
  matchTemplatesState.templates = []
  attachmentsState.hasPending = false
  attachmentsState.runSequence = async () => {}
  cascadeState.byCustomer = {}
  mockPost.mockReset()
  mockPost.mockResolvedValue({ data: { data: { id: 'v-new', title: 'Verpleegkundige' } } })
})

// Fill the required title and submit — the shared last step of most tests below.
async function fillTitleAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Verpleegkundige')
  await user.click(screen.getByRole('button', { name: 'modal.create' }))
}

describe('AddVacancyModal · seven titled cards (SLICE 1)', () => {
  it('renders Algemeen / Klant / Inzet / Functie-eisen / Voorwaarden / Beschrijving / Recruiter', () => {
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.getByText('modal.fields.cardGeneral')).toBeInTheDocument()
    expect(screen.getByText('modal.fields.cardClient')).toBeInTheDocument()
    expect(screen.getByText('modal.fields.cardPlacement')).toBeInTheDocument()
    expect(screen.getByText('details.groups.requirements')).toBeInTheDocument()
    expect(screen.getByText('details.groups.conditions')).toBeInTheDocument()
    expect(screen.getByText('details.description')).toBeInTheDocument()
    expect(screen.getByText('modal.fields.cardOwner')).toBeInTheDocument()
  })
})

describe('AddVacancyModal · card structure (Danny 14-08 recipe — FieldRow label-left)', () => {
  it('keeps every titled card and puts each field label to the LEFT of its control', () => {
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    // Card titles still present (recipe point 2 — titled cards via cardHead/cardBox).
    expect(screen.getByText('modal.fields.cardGeneral')).toBeInTheDocument()
    expect(screen.getByText('modal.fields.cardClient')).toBeInTheDocument()
    expect(screen.getByText('modal.fields.cardPlacement')).toBeInTheDocument()
    // Label-left row (recipe point 3): the title field's label sits before the
    // input in DOM order and the row is a horizontal flex (FieldRow's own layout).
    const titleInput = screen.getByPlaceholderText('modal.titlePlaceholder')
    const row = titleInput.closest('div[style*="align-items: flex-start"]') as HTMLElement
    expect(row).toBeInTheDocument()
    const label = row.querySelector('label')
    expect(label).toBeInTheDocument()
    // The label is the row's first child, the field column is the second — label LEFT of field.
    expect(row.children[0]).toBe(label)
    expect(row.children[0].compareDocumentPosition(titleInput)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })
})

describe('AddVacancyModal · A+D layout (Danny 03-08 — two columns + collapsed secondaries)', () => {
  it('keeps the required title field OUTSIDE any CollapsedCard — visible without opening a section', () => {
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    // GeneralCard (required-core, LEFT column) is never behind a collapsed toggle —
    // no prior click was needed to find its required field (CollapsedCard's own
    // docblock rule: a required field must never live inside one).
    expect(screen.getByPlaceholderText('modal.titlePlaceholder')).toBeInTheDocument()
  })

  it('Matchprofiel starts collapsed', () => {
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.queryByRole('button', { name: 'matching.custom' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'modal.fields.cardMatching' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('AI-agent card starts collapsed (when rendered)', () => {
    authState.hasModule = k => k === 'aiagents'
    authState.hasPermission = p => p === 'settings.view'
    aiAgentsState.options = [{ value: 'a1', label: 'Interview Bot' }]
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.queryByRole('button', { name: 'aiagent.placeholder' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'modal.fields.cardAiAgent' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('Publicatie starts collapsed', () => {
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.queryByRole('switch', { name: 'columns.published' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'modal.fields.cardPublication' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('Documenten+notitie starts collapsed (when rendered)', () => {
    authState.hasPermission = p => p === 'vacancies.update'
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.queryByLabelText('drawer.tabs.documents')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'modal.attachments.cardTitle' })).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('AddVacancyModal · validation', () => {
  it('blocks submit while the title is empty', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    const createBtn = screen.getByRole('button', { name: 'modal.create' })
    expect(createBtn).toBeDisabled()
    await user.click(createBtn)
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('AddVacancyModal · base create body stays byte-identical', () => {
  it('POSTs only the original seven keys when nothing else is filled (owner defaults from auth)', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await fillTitleAndSubmit(user)
    // Piet Recruiter (u1) is both the mocked logged-in user AND in `users`, so
    // owner_id defaults to him (punt 8) — the one base-body field that is no
    // longer null by default now that the recruiter default landed.
    expect(mockPost).toHaveBeenCalledWith('/vacancies', {
      title: 'Verpleegkundige', status: 'open', owner_id: 'u1', customer_id: null,
      industry: null, category: null, location: null,
    })
  })
})

describe('AddVacancyModal · status pill row (punt 7)', () => {
  it('highlights the tenant default pill and sends it, never a form field', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ status: 'open' }))
  })

  it('picking another pill changes the submitted status', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'Closed' }))
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ status: 'closed' }))
  })

  it('renders no pill and sends status: null when the tenant lookup is genuinely empty', async () => {
    lookupState.statuses = []
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Closed' })).not.toBeInTheDocument()
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ status: null }))
  })
})

describe('AddVacancyModal · industry prefill (punt 4)', () => {
  it('prefills an ACTIVE industry name and includes it in the create body', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} initialIndustry="Zorg" />)
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ industry: 'Zorg' }))
  })

  it('falls back to empty for an inactive/unknown industry name (never risks a 422)', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} initialIndustry="Uitgefaseerde Sector" />)
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ industry: null }))
  })
})

describe('AddVacancyModal · klant cascade (punt 6)', () => {
  it('seeds the cascade from the initial location/department props and rides them on the body', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers}
      initialCustomerLocationId="loc-1" initialCustomerLocationName="Locatie Noord"
      initialCustomerDepartmentId="dep-1" initialCustomerDepartmentName="Afdeling ICU" />)
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      customer_location_id: 'loc-1', customer_department_id: 'dep-1',
    }))
  })

  it('omits the cascade keys entirely when no scope is given (default byte-identical)', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await fillTitleAndSubmit(user)
    const [, body] = mockPost.mock.calls[0]
    expect(body).not.toHaveProperty('customer_location_id')
    expect(body).not.toHaveProperty('customer_department_id')
    expect(body).not.toHaveProperty('contact_id')
  })

  it('keeps a locked customer read-only (no picker) while location/department still show', () => {
    render(<AddVacancyModal onClose={noop} users={users} customers={customers}
      lockCustomerId="c1" lockCustomerName="Rivas Zorggroep" />)
    expect(screen.getByText('Rivas Zorggroep')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'modal.fields.client' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'details.customerLocation' })).toBeInTheDocument()
  })
})

describe('AddVacancyModal · cascade narrowing (V3-6, VACATURES-100)', () => {
  // Two customers, each with its OWN sites (nested afdelingen) and contacts —
  // proves a customer SWITCH actually narrows what the deeper pickers offer,
  // never just the same (possibly empty) list reused across ids.
  beforeEach(() => {
    cascadeState.byCustomer = {
      c1: {
        locations: [
          { id: 'loc-1', name: 'Rivas Noord', departments: [{ id: 'dep-1', name: 'ICU' }] },
          { id: 'loc-2', name: 'Rivas Zuid', departments: [{ id: 'dep-2', name: 'Kraamzorg' }] },
        ],
        contacts: [{ id: 'con-1', name: 'Jan Jansen' }],
      },
      c2: {
        locations: [{ id: 'loc-3', name: 'Yesway Centrum' }],
        contacts: [{ id: 'con-2', name: 'Eva Bos' }],
      },
    }
  })

  // Pick a customer via the unlocked Klant picker (open -> click the option).
  async function pickCustomer(user: ReturnType<typeof userEvent.setup>, label: string) {
    await user.click(screen.getByRole('button', { name: 'modal.fields.client' }))
    await user.click(screen.getByRole('button', { name: label }))
  }

  it('narrows the location picker to the picked customer\'s own sites', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await pickCustomer(user, 'Rivas Zorggroep')
    await user.click(screen.getByRole('button', { name: 'details.customerLocation' }))
    expect(screen.getByRole('button', { name: 'Rivas Noord' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rivas Zuid' })).toBeInTheDocument()
    // Yesway's own site must never leak into Rivas's cascade.
    expect(screen.queryByRole('button', { name: 'Yesway Centrum' })).not.toBeInTheDocument()
  })

  it('narrows the department picker to the picked location\'s own afdelingen', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await pickCustomer(user, 'Rivas Zorggroep')
    await user.click(screen.getByRole('button', { name: 'details.customerLocation' }))
    await user.click(screen.getByRole('button', { name: 'Rivas Noord' }))
    await user.click(screen.getByRole('button', { name: 'details.customerDepartment' }))
    expect(screen.getByRole('button', { name: 'ICU' })).toBeInTheDocument()
    // Rivas Zuid's own afdeling must not show once Rivas Noord narrowed the list.
    expect(screen.queryByRole('button', { name: 'Kraamzorg' })).not.toBeInTheDocument()
  })

  it('rides the interactively-picked location/department/contact ids on the create body', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await pickCustomer(user, 'Rivas Zorggroep')
    await user.click(screen.getByRole('button', { name: 'details.customerLocation' }))
    await user.click(screen.getByRole('button', { name: 'Rivas Noord' }))
    await user.click(screen.getByRole('button', { name: 'details.customerDepartment' }))
    await user.click(screen.getByRole('button', { name: 'ICU' }))
    await user.click(screen.getByRole('button', { name: 'details.contactPerson' }))
    await user.click(screen.getByRole('button', { name: 'Jan Jansen' }))
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      customer_id: 'c1', customer_location_id: 'loc-1', customer_department_id: 'dep-1', contact_id: 'con-1',
    }))
  })

  it('changing the customer clears the previously picked location/department/contact — never a stale id on the body', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await pickCustomer(user, 'Rivas Zorggroep')
    await user.click(screen.getByRole('button', { name: 'details.customerLocation' }))
    await user.click(screen.getByRole('button', { name: 'Rivas Noord' }))
    await user.click(screen.getByRole('button', { name: 'details.customerDepartment' }))
    await user.click(screen.getByRole('button', { name: 'ICU' }))
    await user.click(screen.getByRole('button', { name: 'details.contactPerson' }))
    await user.click(screen.getByRole('button', { name: 'Jan Jansen' }))

    // Switch to a different customer — Rivas's now-invalid picks must not survive.
    await pickCustomer(user, 'Yesway Zorg')
    await fillTitleAndSubmit(user)

    const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>]
    expect(body).toMatchObject({ customer_id: 'c2' })
    expect(body).not.toHaveProperty('customer_location_id')
    expect(body).not.toHaveProperty('customer_department_id')
    expect(body).not.toHaveProperty('contact_id')
  })
})

describe('AddVacancyModal · vestiging cosmetic prediction (VAC-VESTIGING-1)', () => {
  beforeEach(() => {
    cascadeState.byCustomer = {
      c1: { locations: [], contacts: [], branch_id: 'branch-1' },
      // A branch id NOT among the picker's own options (branch-1/branch-2) —
      // proves the "freezes" test below can't pass by coincidence.
      c2: { locations: [], contacts: [], branch_id: 'branch-9' },
    }
  })
  async function pickCustomer(user: ReturnType<typeof userEvent.setup>, label: string) {
    await user.click(screen.getByRole('button', { name: 'modal.fields.client' }))
    await user.click(screen.getByRole('button', { name: label }))
  }

  it('proposes the picked customer\'s own mirrored branch onto the create body', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await pickCustomer(user, 'Rivas Zorggroep')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ location_id: 'branch-1' }))
  })

  it('re-predicts the branch on a customer switch while the field stays untouched', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await pickCustomer(user, 'Rivas Zorggroep')
    await pickCustomer(user, 'Yesway Zorg')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ location_id: 'branch-9' }))
  })

  it('freezes the proposal once the recruiter picks the branch by hand — a later customer switch never overwrites it', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await pickCustomer(user, 'Rivas Zorggroep')
    // Manual pick overrides the proposed 'branch-1' with the other option.
    await user.click(screen.getByRole('button', { name: 'modal.fields.branch' }))
    await user.click(screen.getByRole('button', { name: 'Vestiging Zuid' }))
    // Switching customer would otherwise re-propose 'branch-9' — must not happen now.
    await pickCustomer(user, 'Yesway Zorg')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ location_id: 'branch-2' }))
  })
})

describe('AddVacancyModal · Inzet card — contractvorm, adres, vestiging (punt 10/12/13)', () => {
  it('carries a toggled contract type and the structured address, absent when untouched', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'Flex' }))
    await user.type(screen.getByLabelText('details.street'), 'Kerkstraat')
    await user.type(screen.getByLabelText('details.city'), 'Den Haag')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      contract_types: ['flex'], street: 'Kerkstraat', city: 'Den Haag',
      // The single free-text `location` column is DERIVED from the structured address.
      location: 'Kerkstraat, Den Haag',
    }))
  })

  it('picks a vestiging (bureau) via the searchable picker and sends location_id', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'modal.fields.branch' }))
    await user.click(screen.getByRole('button', { name: 'Vestiging Noord' }))
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ location_id: 'branch-1' }))
  })

  // VAC-VESTIGING-1: optional at create — clearing it (or never picking it)
  // must send NO `location_id` key at all, so the server can apply its own
  // default (never a stray `location_id: ''`/`null` on the base create).
  it('sends no location_id key at all when the vestiging is never picked', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await fillTitleAndSubmit(user)
    const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>]
    expect(body).not.toHaveProperty('location_id')
  })

  it('sends no location_id key when a picked vestiging is cleared again', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'modal.fields.branch' }))
    await user.click(screen.getByRole('button', { name: 'Vestiging Noord' }))
    // The shared CreatableSelect's own clear-X (VAC-CLEAR-1) — scoped to the
    // branch FieldRow specifically (other fields elsewhere in the form may
    // also carry a value + their own clear-X).
    const branchLabel = screen.getByText('modal.fields.branch')
    await user.click(within(branchLabel.parentElement as HTMLElement).getByRole('button', { name: 'clearField' }))
    await fillTitleAndSubmit(user)
    const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>]
    expect(body).not.toHaveProperty('location_id')
  })
})

describe('AddVacancyModal · Functie-eisen — senioriteit/opleiding + skills (punt 14/15)', () => {
  it('picks a seniority level and adds a required skill', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'details.seniority' }))
    await user.click(screen.getByRole('button', { name: 'Senior' }))
    // K6e: RequiredSkillsSection's add/edit/remove list — the "+" trigger opens
    // an inline AddForm (placeholder = the field label), saved via the diskette icon.
    await user.click(screen.getByRole('button', { name: /details\.addSkill/ }))
    await user.type(screen.getByPlaceholderText('details.addSkill'), 'BIG-registratie')
    await user.click(screen.getByTitle('save'))
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      seniority: 'senior', skills: ['BIG-registratie'],
    }))
  })

  it('edits a staged required skill in place (K6e)', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: /details\.addSkill/ }))
    await user.type(screen.getByPlaceholderText('details.addSkill'), 'BIG-registratie')
    await user.click(screen.getByTitle('save'))
    // The saved row now carries an edit pencil (RequiredSkillsSection/AddableSection).
    await user.click(screen.getByTitle('edit'))
    const input = screen.getByPlaceholderText('details.addSkill')
    await user.clear(input)
    await user.type(input, 'VCA-certificaat')
    await user.click(screen.getByTitle('save'))
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      skills: ['VCA-certificaat'],
    }))
  })

  it('never adds experience_min_years/experience_max_years — not accepted by the backend', () => {
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.queryByText('details.experience')).not.toBeInTheDocument()
  })
})

describe('AddVacancyModal · Voorwaarden — salaris + uren (punt 16)', () => {
  it('carries salary min/max/period and hours min/max', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    const salaryInputs = screen.getAllByPlaceholderText('min')
    await user.type(salaryInputs[0], '2500')
    await user.type(screen.getByPlaceholderText('modal.fields.salaryPeriodPlaceholder'), 'per maand')
    await user.type(screen.getAllByPlaceholderText('max')[1], '32')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      salary_min: '2500', salary_period: 'per maand', hours_max: '32',
    }))
  })
})

describe('AddVacancyModal · Beschrijving (punt 9)', () => {
  it('reveals the rich-text editor on click and carries the typed description', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: /details.description/ }))
    await user.type(screen.getByLabelText('rich-text-editor'), 'Dienst op de IC-afdeling.')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ description: 'Dienst op de IC-afdeling.' }))
  })
})

describe('AddVacancyModal · Matchprofiel (punt 18)', () => {
  const template = { id: 't1', name: 'IC-team', weights: { qualifications: 5, technical_fit: 4, soft_skills: 3, cultural_alignment: 3, career_aspirations: 2, location: 4 }, linkedVacanciesCount: 0 }

  it('picking a template alone sends only match_weight_template_id (server snapshots the weights)', async () => {
    matchTemplatesState.templates = [template]
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    // A+D layout (03-08): Matchprofiel is a CollapsedCard, closed by default — open it first.
    await user.click(screen.getByRole('button', { name: 'modal.fields.cardMatching' }))
    await user.click(screen.getByRole('button', { name: 'matching.custom' }))
    await user.click(screen.getByRole('button', { name: 'IC-team' }))
    await fillTitleAndSubmit(user)

    const [, body] = mockPost.mock.calls[0]
    expect(body).toMatchObject({ match_weight_template_id: 't1' })
    expect(body).not.toHaveProperty('match_weights')
  })

  it('editing a slider after picking a template sends match_weights alongside the template id', async () => {
    matchTemplatesState.templates = [template]
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'modal.fields.cardMatching' }))
    await user.click(screen.getByRole('button', { name: 'matching.custom' }))
    await user.click(screen.getByRole('button', { name: 'IC-team' }))
    await user.click(screen.getByRole('button', { name: 'matching.adjust' }))
    const slider = screen.getByRole('slider', { name: 'matching.dim.qualifications' })
    slider.focus()
    await user.keyboard('{ArrowLeft}')
    await fillTitleAndSubmit(user)

    const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>]
    expect(body.match_weight_template_id).toBe('t1')
    expect(body.match_weights).toMatchObject({ qualifications: 4 })
  })
})

describe('AddVacancyModal · AI-agent card gating (punt 19)', () => {
  it('renders NOTHING without module aiagents + settings.view — never a disabled tease', () => {
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.queryByText('modal.fields.cardAiAgent')).not.toBeInTheDocument()
  })

  it('renders the picker and sends ai_agent_id once both module + permission are present', async () => {
    authState.hasModule = k => k === 'aiagents'
    authState.hasPermission = p => p === 'settings.view'
    aiAgentsState.options = [{ value: 'a1', label: 'Interview Bot' }]
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.getByText('modal.fields.cardAiAgent')).toBeInTheDocument()

    // A+D layout (03-08): AI-agent is a CollapsedCard, closed by default — open it first.
    await user.click(screen.getByRole('button', { name: 'modal.fields.cardAiAgent' }))
    await user.click(screen.getByRole('button', { name: 'aiagent.placeholder' }))
    await user.click(screen.getByRole('button', { name: 'Interview Bot' }))
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ ai_agent_id: 'a1' }))
  })
})

describe('AddVacancyModal · Publicatie (punt 20)', () => {
  it('omits published/published_channels/application_settings entirely when untouched (base body stays byte-identical)', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await fillTitleAndSubmit(user)
    const [, body] = mockPost.mock.calls[0]
    expect(body).not.toHaveProperty('published')
    expect(body).not.toHaveProperty('published_channels')
    expect(body).not.toHaveProperty('application_settings')
  })

  it('carries published, published_channels and application_settings once touched', async () => {
    lookupState.channels = [{ value: 'indeed', label: 'Indeed' }]
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)

    // A+D layout (03-08): Publicatie is a CollapsedCard, closed by default — open it first.
    await user.click(screen.getByRole('button', { name: 'modal.fields.cardPublication' }))
    // Master published toggle (the table/insights "Gepubliceerd" bucket).
    await user.click(screen.getByRole('switch', { name: 'columns.published' }))
    // One job-board channel toggle.
    await user.click(screen.getByRole('switch', { name: 'Indeed' }))
    // One application-setting change — the trigger is scoped to the CV row; the
    // OPTIONS live in the portalled menu (PORTAL-MARKER-1), the only one open.
    const cvRow = screen.getByText('publishing.fields.cv').parentElement as HTMLElement
    await user.click(within(cvRow).getByRole('button'))
    const menu = document.querySelector('[data-dropdown-portal]') as HTMLElement
    await user.click(within(menu).getByRole('button', { name: 'publishing.values.optional' }))

    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      published: true,
      published_channels: [{ value: 'indeed', published: true }],
      application_settings: expect.objectContaining({ cv: 'optional' }),
    }))
  })
})

describe('AddVacancyModal · post-create attachments sequencing gate (punten 21+22)', () => {
  it('closes immediately when nothing is pending (the common case, pre-SLICE-2 behaviour)', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={onClose} users={users} customers={customers} />)
    await fillTitleAndSubmit(user)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT run the post-create sequence without vacancies.update, even with pending attachments', async () => {
    attachmentsState.hasPending = true
    const runSequence = vi.fn(async () => {})
    attachmentsState.runSequence = runSequence
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={onClose} users={users} customers={customers} />)
    await fillTitleAndSubmit(user)
    expect(runSequence).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('runs the post-create sequence with the new id and shows the results panel instead of closing', async () => {
    authState.hasPermission = p => p === 'vacancies.update'
    attachmentsState.hasPending = true
    const runSequence = vi.fn(async () => {})
    attachmentsState.runSequence = runSequence
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={onClose} users={users} customers={customers} />)
    await fillTitleAndSubmit(user)

    expect(runSequence).toHaveBeenCalledWith('v-new')
    expect(onClose).not.toHaveBeenCalled()
    // POPUP-SLEEP-1: the panel title bar repeats the results heading — assert presence, not uniqueness.
    expect(screen.getAllByText('modal.attachments.resultsTitle').length).toBeGreaterThan(0)
  })
})
