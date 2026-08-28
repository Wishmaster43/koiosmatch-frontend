/**
 * AddVacancyModal — layout/chrome slice (split from AddVacancyModal.test.tsx,
 * §3 1000-line hard-cap, Opus fixAdvies): titled cards, A+D collapsed-secondary
 * layout, free-switching tabs, base validation, the byte-identical base create
 * body and the status-pill row + industry prefill. Klant-cascade/Inzet/
 * Functie-eisen/Voorwaarden/Beschrijving live in .cascade.test.tsx; Matchprofiel/
 * AI-agent/Publicatie/attachments/Excel live in .slice2.test.tsx.
 *
 * Network-backed hooks are mocked directly (no QueryClient needed, mirrors
 * AddCandidateModal.test.tsx); i18next is uninitialised so t() returns raw keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddVacancyModal from './AddVacancyModal'
import { users, customers, noop, makeDefaultStatuses, fillTitleAndSubmit, openTab } from './AddVacancyModal.testFixtures'
// EXCEL-VACATURES-1: only the NETWORK calls are mocked so the import wizard
// module loads cleanly (its own behaviour is covered in .slice2.test.tsx).
import { dryRunImport, runImport } from '@/pages/settings/sections/import/importApi'

vi.mock('@/pages/settings/sections/import/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/import/importApi')>()
  return { ...actual, dryRunImport: vi.fn(), runImport: vi.fn(), downloadImportTemplate: vi.fn() }
})

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
    statuses: [] as Array<{ value: string; label: string; color?: string }>,
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
  // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
  useLookups: () => ({ candidateTypes: [{ value: 'flex', label: 'Flex', color: '#6E8FD6' }, { value: 'zzp', label: 'ZZP', color: '#79B58E' }] }),
}))
vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: ['Zorg', 'IT'], industryOptions: ['Zorg', 'IT'].map(n => ({ value: n, label: n })) }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG', 'Helpende'], functionOptions: ['Verzorgende IG', 'Helpende'].map(n => ({ value: n, label: n })), allowFreeEntry: false }) }))
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'branch-1', label: 'Vestiging Noord' }, { value: 'branch-2', label: 'Vestiging Zuid' }],
}))
vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: ['Zuid-Holland', 'Utrecht'] }) }))
// The cascade fetch itself — stubbed so this slice never touches the cascade
// narrowing logic (that is the .cascade.test.tsx file's own concern).
const { cascadeState } = vi.hoisted(() => ({
  cascadeState: {
    byCustomer: {} as Record<string, {
      locations: Array<{ id: string; name: string; departments?: Array<{ id: string; name: string }> }>
      contacts: Array<{ id: string; name: string }>
      branch_id?: string
    }>,
  },
}))
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
// SLICE-2 gates stay closed), so this slice never sees AiAgentCard/AttachmentsCard.
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
const { matchTemplatesState } = vi.hoisted(() => ({
  matchTemplatesState: { templates: [] as Array<{ id: string; name: string; weights: Record<string, number>; linkedVacanciesCount: number }> },
}))
vi.mock('./hooks/useMatchWeightTemplates', () => ({ useMatchWeightTemplates: () => ({ templates: matchTemplatesState.templates, loading: false, error: false }) }))
const { aiAgentsState } = vi.hoisted(() => ({
  aiAgentsState: {
    options: [] as Array<{ value: string; label: string }>,
    agents: [] as Array<{ id: string; name: string; user?: { id: string; name?: string } | null }>,
  },
}))
vi.mock('./hooks/useAiAgents', () => ({ useAiAgents: () => ({ options: aiAgentsState.options, agents: aiAgentsState.agents, loading: false, error: false }) }))
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

beforeEach(() => {
  detailByCustomer.clear()
  lookupState.statuses = makeDefaultStatuses()
  lookupState.channels = []
  authState.hasModule = () => false
  authState.hasPermission = () => false
  aiAgentsState.options = []
  aiAgentsState.agents = []
  matchTemplatesState.templates = []
  attachmentsState.hasPending = false
  attachmentsState.runSequence = async () => {}
  cascadeState.byCustomer = {}
  mockPost.mockReset()
  mockPost.mockResolvedValue({ data: { data: { id: 'v-new', title: 'Verpleegkundige' } } })
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
})

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

  it('Matchprofiel starts collapsed', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await openTab(user, 'matching')
    expect(screen.queryByRole('button', { name: 'matching.custom' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'modal.fields.cardMatching' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('AI-agent card starts collapsed (when rendered)', async () => {
    const user = userEvent.setup()
    authState.hasModule = k => k === 'aiagents'
    authState.hasPermission = p => p === 'settings.view'
    aiAgentsState.options = [{ value: 'a1', label: 'Interview Bot' }]
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await openTab(user, 'aiAgent')
    expect(screen.queryByRole('button', { name: 'aiagent.placeholder' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'modal.fields.cardAiAgent' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('Publicatie starts collapsed', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await openTab(user, 'publication')
    expect(screen.queryByRole('switch', { name: 'columns.published' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'modal.fields.cardPublication' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('Documenten+notitie starts collapsed (when rendered)', async () => {
    const user = userEvent.setup()
    authState.hasPermission = p => p === 'vacancies.update'
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await openTab(user, 'attachments')
    expect(screen.queryByLabelText('drawer.tabs.documents')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'modal.attachments.cardTitle' })).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('AddVacancyModal · free-switching tabs (TABBLADEN-1, Danny 27-08)', () => {
  it('keeps a typed title after switching to another tab and back', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Verpleegkundige')
    await openTab(user, 'matching')
    await openTab(user, 'general')
    expect(screen.getByPlaceholderText('modal.titlePlaceholder')).toHaveValue('Verpleegkundige')
  })

  it('blocks Create while the required title is empty, on any tab', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await openTab(user, 'requirements')
    expect(screen.getByRole('button', { name: 'modal.create' })).toBeDisabled()
  })

  it('switches to the owning tab when the server rejects a non-General field (422)', async () => {
    // A server-side 422 on `description` (VacancyWriter/StoreVacancyRequest) maps
    // back onto the form's own `description` field — owned by the "Vacancy text"
    // tab — so a rejection lands the recruiter there even though submit happened
    // from a different, currently-active tab.
    mockPost.mockRejectedValueOnce({ response: { data: { errors: { description: ['too long'] } } } })
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await openTab(user, 'requirements')
    await fillTitleAndSubmit(user)
    expect(await screen.findByRole('tab', { name: 'modal.tabs.description' })).toHaveAttribute('aria-selected', 'true')
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
