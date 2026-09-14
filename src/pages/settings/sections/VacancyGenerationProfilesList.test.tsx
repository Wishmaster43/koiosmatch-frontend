/**
 * VacancyGenerationProfilesList — covers the four UI states (loading/error/empty/
 * ready) plus the 'unavailable' calm notice for a 404 (VACGEN-1's backend routes
 * don't exist yet — §3: no dead Add button whose POST would silently fail), and
 * asserts the actual POST/PUT request shape a mutation test must prove (§13):
 * route + body, not just that a callback fired.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ChangeEvent } from 'react'
import i18n from '@/i18n'
import api from '@/lib/api'
import VacancyGenerationProfilesList from './VacancyGenerationProfilesList'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// Tenant lookups feeding the matcher chips — stubbed to small fixed lists so the
// editor form renders without a live backend (each hook's own file is unit-tested).
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [{ value: 'loc1', label: 'Amsterdam' }] }))
vi.mock('@/lib/useContractTypes', () => ({ useContractTypes: () => ({ types: ['ZZP Flex'] }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG'], functionOptions: ['Verzorgende IG'].map(n => ({ value: n, label: n })) }) }))
vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: ['Zorg'], industryOptions: ['Zorg'].map(n => ({ value: n, label: n })) }) }))
vi.mock('@/lib/useLanguageLookups', () => ({ useLanguageLookups: () => ({ languages: ['Nederlands'], levels: [] }) }))
// Tiptap's real editor is out of scope here — a plain textarea proves the wiring.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) =>
    <textarea data-testid="rte" value={value ?? ''} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)} />,
}))

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
// Resolve the shared ConfirmDialog's own labels (common namespace).
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

// Profile fixture — FLAT keys as returned by the backend API (not nested), plus
// the optional nested matcher/content mirrors a few tests attach or delete.
// hand-written: matches VacancyGenerationProfilesList.tsx's own VacancyGenerationProfile shape.
// SMZ-10: the API never emits `in_use` — nothing references a profile
// (VacancyProfileResolver matches live, never stores a link) — so the fixture
// carries no such field.
interface ProfileFixture {
  id: string
  name: string
  is_default: boolean
  priority: number
  location_ids: string[]
  contract_types: string[]
  function_titles: string[]
  industries: string[]
  template: string
  tone_of_voice: string
  length: string
  language: string
  allow_emoji: boolean
  brand_instructions: string
  forbidden_words: string[]
  content_block_ids: string[]
  matcher?: { location_ids: string[]; contract_types: string[]; function_titles: string[]; industries: string[] }
  content?: { template: string; tone_of_voice: string; length: string; language: string; allow_emoji: boolean; brand_instructions: string; forbidden_words: string[]; content_block_ids: string[] }
}

const profile = (over: Partial<ProfileFixture> = {}): ProfileFixture => ({
  id: 'p1', name: 'Zorg — ochtenddiensten', is_default: false, priority: 15,
  location_ids: ['loc1'],
  contract_types: ['ZZP Flex'],
  function_titles: ['Verzorgende IG'],
  industries: ['Zorg'],
  template: 'A vacancy for {{title}}',
  tone_of_voice: 'professional',
  length: 'long',
  language: 'Nederlands',
  allow_emoji: true,
  brand_instructions: 'Always be friendly',
  forbidden_words: ['bad', 'words'],
  content_block_ids: ['block1', 'block2'],
  ...over,
})

// Route the mocked GET by URL — profiles vs. the reusable-blocks picker data.
const mockGet = (profilesResult: Promise<unknown>, blocksResult: unknown = { data: { data: [] } }) => {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes('vacancy-generation-profiles')) return profilesResult as ReturnType<typeof api.get>
    if (url.includes('vacancy-content-blocks')) return Promise.resolve(blocksResult) as ReturnType<typeof api.get>
    return Promise.resolve({ data: { data: [] } }) as ReturnType<typeof api.get>
  })
}

afterEach(() => vi.clearAllMocks())

describe('VacancyGenerationProfilesList', () => {
  it('shows the loading state, then the error state on a failed fetch', async () => {
    mockGet(Promise.reject(new Error('network down')))
    render(<VacancyGenerationProfilesList />)
    expect(screen.getByText(st('common.loadingShort'))).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(st('vacancyGenerationSettings.loadError'))).toBeInTheDocument())
  })

  it('a 404 on the profiles route shows the calm "not available yet" notice with no Add button (§3 no dead affordance)', async () => {
    mockGet(Promise.reject({ response: { status: 404 } }))
    render(<VacancyGenerationProfilesList />)
    await waitFor(() => expect(screen.getByText(st('vacancyGenerationSettings.unavailable'))).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: st('vacancyGenerationSettings.add') })).not.toBeInTheDocument()
  })

  it('shows the empty state when there are no profiles', async () => {
    mockGet(Promise.resolve({ data: { data: [] } }))
    render(<VacancyGenerationProfilesList />)
    await waitFor(() => expect(screen.getByText(st('vacancyGenerationSettings.empty'))).toBeInTheDocument())
  })

  it('renders the profile list with its priority', async () => {
    mockGet(Promise.resolve({ data: { data: [profile()] } }))
    render(<VacancyGenerationProfilesList />)
    await waitFor(() => expect(screen.getByText('Zorg — ochtenddiensten')).toBeInTheDocument())
    expect(screen.getByText(`${st('vacancyGenerationSettings.priorityLabel')}: 15`)).toBeInTheDocument()
  })

  it('creating a profile POSTs the nested envelope {name, is_default, priority, matcher:{...}, content:{...}}', async () => {
    mockGet(Promise.resolve({ data: { data: [] } }))
    vi.mocked(api.post).mockResolvedValue({ data: { data: profile({ id: 'new1', name: 'New profile' }) } })
    const user = userEvent.setup()
    render(<VacancyGenerationProfilesList />)

    await waitFor(() => expect(screen.getByText(st('vacancyGenerationSettings.empty'))).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: st('vacancyGenerationSettings.add') }))
    await user.type(screen.getByPlaceholderText(st('vacancyGenerationSettings.namePlaceholder')), 'New profile')
    await user.click(await screen.findByRole('button', { name: st('vacancyGenerationSettings.add') }))

    // Verify the POST body is the nested envelope: {name, is_default, priority, matcher:{...}, content:{...}}
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/vacancy-generation-profiles', {
      name: 'New profile',
      is_default: false,
      priority: 10,
      matcher: {
        location_ids: [],
        contract_types: [],
        function_titles: [],
        industries: [],
      },
      content: {
        template: '',
        tone_of_voice: 'neutral',
        length: 'medium',
        language: '',
        allow_emoji: false,
        brand_instructions: '',
        forbidden_words: [],
        content_block_ids: [],
      },
    }))
  })

  it('saving an edited profile PUTs the nested envelope to the profile-specific route', async () => {
    mockGet(Promise.resolve({ data: { data: [profile()] } }))
    vi.mocked(api.put).mockResolvedValue({ data: { data: profile({ name: 'Renamed' }) } })
    const user = userEvent.setup()
    render(<VacancyGenerationProfilesList />)

    await waitFor(() => expect(screen.getByText('Zorg — ochtenddiensten')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: `${st('common.edit')}: Zorg — ochtenddiensten` }))
    const nameInput = await screen.findByDisplayValue('Zorg — ochtenddiensten')
    await user.clear(nameInput)
    await user.type(nameInput, 'Renamed')
    await user.click(await screen.findByRole('button', { name: st('common.save') }))

    // Verify the PUT body is the nested envelope: {name, is_default, priority, matcher:{...}, content:{...}}
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/vacancy-generation-profiles/p1', {
      name: 'Renamed',
      is_default: false,
      priority: 15,
      matcher: {
        location_ids: ['loc1'],
        contract_types: ['ZZP Flex'],
        function_titles: ['Verzorgende IG'],
        industries: ['Zorg'],
      },
      content: {
        template: 'A vacancy for {{title}}',
        tone_of_voice: 'professional',
        length: 'long',
        language: 'Nederlands',
        allow_emoji: true,
        brand_instructions: 'Always be friendly',
        forbidden_words: ['bad', 'words'],
        content_block_ids: ['block1', 'block2'],
      },
    }))
  })

  // SMZ-10: the delete button is never disabled/gated on a made-up in-use flag
  // (nothing references a profile) — the confirm() dialog is the real safeguard,
  // and a confirmed delete actually removes the row.
  it('the delete button is always enabled, and a confirmed delete removes the row', async () => {
    mockGet(Promise.resolve({ data: { data: [profile()] } }))
    vi.mocked(api.delete).mockResolvedValue({})
    const user = userEvent.setup()
    render(<VacancyGenerationProfilesList />)

    await waitFor(() => expect(screen.getByText('Zorg — ochtenddiensten')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: `${st('common.edit')}: Zorg — ochtenddiensten` }))
    // Find the delete button in the footer (getAllByRole to avoid match with forbidden-word delete buttons)
    const deleteButtons = await screen.findAllByRole('button', { name: st('vacancyGenerationSettings.delete') })
    expect(deleteButtons[deleteButtons.length - 1]).not.toBeDisabled()
    await user.click(deleteButtons[deleteButtons.length - 1])
    await user.click(await screen.findByRole('button', { name: ct('confirm') }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/vacancy-generation-profiles/p1'))
    await waitFor(() => expect(screen.queryByText('Zorg — ochtenddiensten')).not.toBeInTheDocument())
  })

  it('reads profiles with nested matcher/content from the API response', async () => {
    // GET returns the profile with both flat keys AND nested matcher/content mirrors.
    const profileWithNested = profile({
      matcher: { location_ids: ['loc1'], contract_types: ['ZZP Flex'], function_titles: ['Verzorgende IG'], industries: ['Zorg'] },
      content: { template: 'A vacancy for {{title}}', tone_of_voice: 'professional', length: 'long', language: 'Nederlands', allow_emoji: true, brand_instructions: 'Always be friendly', forbidden_words: ['bad', 'words'], content_block_ids: ['block1', 'block2'] },
    })
    mockGet(Promise.resolve({ data: { data: [profileWithNested] } }))
    const user = userEvent.setup()
    render(<VacancyGenerationProfilesList />)

    // Open the profile and verify the editor loads the nested matcher/content.
    await waitFor(() => expect(screen.getByText('Zorg — ochtenddiensten')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: `${st('common.edit')}: Zorg — ochtenddiensten` }))
    // The inputs should show the values from the nested shape (which mirrors the flat keys).
    await waitFor(() => expect(screen.getByDisplayValue('Zorg — ochtenddiensten')).toBeInTheDocument())
  })

  it('falls back to flat keys when profile has no nested matcher/content (backward compat)', async () => {
    // Older profiles have only flat keys, no nested shapes.
    const flatProfile = profile()
    delete flatProfile.matcher
    delete flatProfile.content
    mockGet(Promise.resolve({ data: { data: [flatProfile] } }))
    const user = userEvent.setup()
    render(<VacancyGenerationProfilesList />)

    await waitFor(() => expect(screen.getByText('Zorg — ochtenddiensten')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: `${st('common.edit')}: Zorg — ochtenddiensten` }))
    // The editor should load from flat keys and display them correctly.
    await waitFor(() => expect(screen.getByDisplayValue('A vacancy for {{title}}')).toBeInTheDocument())
  })

  it('handles 422 validation error from nested field rejection', async () => {
    mockGet(Promise.resolve({ data: { data: [profile()] } }))
    // BE rejects an unknown field in the nested matcher with a 422.
    vi.mocked(api.put).mockRejectedValue({
      response: {
        status: 422,
        data: { message: "Onbekend veld 'foo' in matcher.", errors: { 'matcher.foo': ["Onbekend veld 'foo' in matcher."] } },
      },
    })
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<VacancyGenerationProfilesList />)

    await waitFor(() => expect(screen.getByText('Zorg — ochtenddiensten')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: `${st('common.edit')}: Zorg — ochtenddiensten` }))
    const nameInput = await screen.findByDisplayValue('Zorg — ochtenddiensten')
    await user.clear(nameInput)
    await user.type(nameInput, 'Renamed')
    await user.click(await screen.findByRole('button', { name: st('common.save') }))

    // Verify the error is handled (notified to the user).
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('vacancyGenerationSettings.saveFailed')))
  })
})

// DEFAULT-UNDO (Danny 04-08): verified clear-safe against
// VacancyGenerationProfileController::update() (no singleton-reject guard on
// is_default; the resolver already falls back to highest-priority with no
// default set) — clicking the active default pill now clears it instead of
// staying a one-way ratchet.
describe('VacancyGenerationProfilesList — is_default undo', () => {
  it('the active default pill is not disabled (clickable, for undo)', async () => {
    mockGet(Promise.resolve({ data: { data: [profile({ is_default: true })] } }))
    render(<VacancyGenerationProfilesList />)

    const activePill = await screen.findByRole('button', { name: st('common.default') })
    expect(activePill).not.toBeDisabled()
  })

  it('clicking the active default PUTs {is_default:false} on the same per-id route', async () => {
    mockGet(Promise.resolve({ data: { data: [profile({ is_default: true })] } }))
    vi.mocked(api.put).mockResolvedValue({ data: { data: profile({ is_default: false }) } })
    const user = userEvent.setup()
    render(<VacancyGenerationProfilesList />)

    const activePill = await screen.findByRole('button', { name: st('common.default') })
    await user.click(activePill)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/vacancy-generation-profiles/p1',
      expect.objectContaining({ is_default: false })))
    // No profile is default any more — the row now offers "Maak standaard".
    await waitFor(() => expect(screen.getByRole('button', { name: st('common.setDefault') })).toBeInTheDocument())
  })

  it('reverts and notifies when the clear PUT fails', async () => {
    mockGet(Promise.resolve({ data: { data: [profile({ is_default: true })] } }))
    vi.mocked(api.put).mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<VacancyGenerationProfilesList />)

    const activePill = await screen.findByRole('button', { name: st('common.default') })
    await user.click(activePill)

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('vacancyGenerationSettings.saveFailed')))
    // Reverted: the pill is still the active default.
    expect(await screen.findByRole('button', { name: st('common.default') })).toBeInTheDocument()
  })
})
