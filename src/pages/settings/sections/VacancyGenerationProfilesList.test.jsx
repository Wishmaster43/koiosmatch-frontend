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
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG'] }) }))
vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: ['Zorg'] }) }))
vi.mock('@/lib/useLanguageLookups', () => ({ useLanguageLookups: () => ({ languages: ['Nederlands'], levels: [] }) }))
// Tiptap's real editor is out of scope here — a plain textarea proves the wiring.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }) => <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />,
}))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })
// Resolve the shared ConfirmDialog's own labels (common namespace).
const ct = (key, opts) => i18n.t(key, { ns: 'common', ...opts })

const profile = (over = {}) => ({
  id: 'p1', name: 'Zorg — ochtenddiensten', is_default: false, priority: 10,
  matcher: { location_ids: [], contract_types: [], function_titles: [], industries: [] },
  content: { template: '', tone_of_voice: 'neutral', length: 'medium', language: '', allow_emoji: false, brand_instructions: '', forbidden_words: [], content_block_ids: [] },
  in_use: false,
  ...over,
})

// Route the mocked GET by URL — profiles vs. the reusable-blocks picker data.
const mockGet = (profilesResult, blocksResult = { data: { data: [] } }) => {
  api.get.mockImplementation((url) => {
    if (url.includes('vacancy-generation-profiles')) return profilesResult
    if (url.includes('vacancy-content-blocks')) return Promise.resolve(blocksResult)
    return Promise.resolve({ data: { data: [] } })
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
    expect(screen.getByText(`${st('vacancyGenerationSettings.priorityLabel')}: 10`)).toBeInTheDocument()
  })

  it('creating a profile POSTs the full matcher/content body shape to the profiles route', async () => {
    mockGet(Promise.resolve({ data: { data: [] } }))
    api.post.mockResolvedValue({ data: { data: profile({ id: 'new1', name: 'New profile' }) } })
    const user = userEvent.setup()
    render(<VacancyGenerationProfilesList />)

    await waitFor(() => expect(screen.getByText(st('vacancyGenerationSettings.empty'))).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: st('vacancyGenerationSettings.add') }))
    await user.type(screen.getByPlaceholderText(st('vacancyGenerationSettings.namePlaceholder')), 'New profile')
    await user.click(await screen.findByRole('button', { name: st('vacancyGenerationSettings.add') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/vacancy-generation-profiles', expect.objectContaining({
      name: 'New profile',
      is_default: false,
      priority: 10,
      matcher: { location_ids: [], contract_types: [], function_titles: [], industries: [] },
      content: expect.objectContaining({ tone_of_voice: 'neutral', length: 'medium', allow_emoji: false, forbidden_words: [] }),
    })))
  })

  it('saving an edited profile PUTs to the profile-specific route with the edited name', async () => {
    mockGet(Promise.resolve({ data: { data: [profile()] } }))
    api.put.mockResolvedValue({ data: { data: profile({ name: 'Renamed' }) } })
    const user = userEvent.setup()
    render(<VacancyGenerationProfilesList />)

    await waitFor(() => expect(screen.getByText('Zorg — ochtenddiensten')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: `${st('common.edit')}: Zorg — ochtenddiensten` }))
    const nameInput = await screen.findByDisplayValue('Zorg — ochtenddiensten')
    await user.clear(nameInput)
    await user.type(nameInput, 'Renamed')
    await user.click(await screen.findByRole('button', { name: st('common.save') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/vacancy-generation-profiles/p1', expect.objectContaining({ name: 'Renamed' })))
  })

  it('a 409 on delete keeps the row and blocks re-deletion instead of removing it', async () => {
    mockGet(Promise.resolve({ data: { data: [profile()] } }))
    api.delete.mockRejectedValue({ response: { status: 409 } })
    const user = userEvent.setup()
    render(<VacancyGenerationProfilesList />)

    await waitFor(() => expect(screen.getByText('Zorg — ochtenddiensten')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: `${st('common.edit')}: Zorg — ochtenddiensten` }))
    await user.click(await screen.findByRole('button', { name: st('vacancyGenerationSettings.delete') }))
    await user.click(await screen.findByRole('button', { name: ct('confirm') }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/vacancy-generation-profiles/p1'))
    expect(screen.getByText('Zorg — ochtenddiensten')).toBeInTheDocument()
  })
})
