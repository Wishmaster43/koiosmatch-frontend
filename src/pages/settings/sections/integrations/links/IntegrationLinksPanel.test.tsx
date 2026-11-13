/**
 * IntegrationLinksPanel — filters registered with only the permitted types, the search
 * debounced into the request params, pagination, and the save request.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import IntegrationLinksPanel from './IntegrationLinksPanel'
import { notifyError } from '@/lib/notify'
import { listLinks, putLink } from './linksApi'

vi.mock('./linksApi', () => ({ listLinks: vi.fn(), putLink: vi.fn() }))
const mockList = listLinks as unknown as ReturnType<typeof vi.fn>
const mockPutLink = putLink as unknown as ReturnType<typeof vi.fn>

const mockRegister = vi.fn()
vi.mock('@/context/RightPanelContext', () => ({ useRightPanel: () => ({ registerFilters: mockRegister, unregisterFilters: vi.fn(), reportPageFilter: vi.fn() }) }))
const mockAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth() }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const t = (key: string) => i18n.t(key, { ns: 'settings' })
const page = (n: number) => ({
  rows: [{ entity_type: 'candidate', entity_id: 'c1', label: 'Ada', system: 'helloflex', external_id: 'HF-1', status: 'linked', error: null,
    synced_at: null, linked_at: null, linked_by: null, linked_by_name: null, updated_at: null }],
  total: 120, page: n, lastPage: 3, perPage: 50,
})
const renderPanel = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <IntegrationLinksPanel system="helloflex" />
  </QueryClientProvider>)

beforeEach(() => {
  vi.clearAllMocks()
  mockList.mockImplementation((p: { page?: number }) => Promise.resolve(page(p.page ?? 1)))
  mockAuth.mockReturnValue({ hasPermission: (k: string) => ['candidates.view', 'matches.view', 'settings.update'].includes(k) })
})

describe('IntegrationLinksPanel', () => {
  // Only the types the viewer may see are offered, and the system is preset in the first request.
  it('registers type and status filters with only permitted types and presets the system', async () => {
    renderPanel()
    await screen.findByText('Ada')
    const groups = mockRegister.mock.calls.at(-1)![1] as Array<{ key: string; options: Array<{ value: string }> }>
    // settings.update alone unlocks no extra type: branch/user list with settings.view, cost_center with customers.view.
    expect(groups.find((g) => g.key === 'type')!.options.map((o) => o.value)).toEqual(['candidate', 'match'])
    expect(groups.find((g) => g.key === 'status')!.options.map((o) => o.value)).toEqual(['linked', 'pending', 'syncing', 'failed', 'unlinked'])
    expect(mockList.mock.calls[0][0]).toMatchObject({ system: 'helloflex', page: 1, perPage: 50 })
  })

  // The debounced search lands in the request params.
  it('sends the search term in the params', async () => {
    renderPanel()
    await screen.findByText('Ada')
    fireEvent.change(screen.getByPlaceholderText(t('integrations.links.searchPlaceholder')), { target: { value: 'ada' } })
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'ada', system: 'helloflex' }), expect.anything()))
  })

  // Next page re-requests with page 2.
  it('requests the next page from the pagination bar', async () => {
    renderPanel()
    await screen.findByText('Ada')
    await userEvent.click(screen.getByRole('button', { name: i18n.t('nextPage', { ns: 'common' }) }))
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything()))
  })

  // Clear-filters empties the search input and re-requests without the search param.
  it('clear filters also empties the search box', async () => {
    renderPanel()
    await screen.findByText('Ada')
    const box = screen.getByPlaceholderText(t('integrations.links.searchPlaceholder')) as HTMLInputElement
    fireEvent.change(box, { target: { value: 'ada' } })
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'ada' }), expect.anything()))
    await userEvent.click(await screen.findByRole('button', { name: i18n.t('clearFilters', { ns: 'common' }) }))
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ search: '' }), expect.anything()))
    expect((screen.getByPlaceholderText(t('integrations.links.searchPlaceholder')) as HTMLInputElement).value).toBe('')
  })

  // A failed save toasts the error, keeps the draft, and sends the PUT first.
  it('toasts and keeps the draft when the save fails', async () => {
    mockPutLink.mockRejectedValue(new Error('boom'))
    renderPanel()
    const input = await screen.findByRole('textbox', { name: t('integrations.links.columns.externalId') })
    await userEvent.clear(input)
    await userEvent.type(input, 'HF-9')
    await userEvent.click(screen.getByRole('button', { name: i18n.t('save', { ns: 'common' }) }))
    await waitFor(() => expect(mockPutLink).toHaveBeenCalledWith({ entity_type: 'candidate', entity_id: 'c1', system: 'helloflex', external_id: 'HF-9' }))
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect((screen.getByRole('textbox', { name: t('integrations.links.columns.externalId') }) as HTMLInputElement).value).toBe('HF-9')
  })

  // A toggled type filter reaches the request as entity types.
  it('sends the toggled type filter as entityTypes', async () => {
    renderPanel()
    await screen.findByText('Ada')
    const groups = mockRegister.mock.calls.at(-1)![1] as Array<{ key: string; onToggle: (v: string) => void }>
    groups.find((g) => g.key === 'type')!.onToggle('candidate')
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ entityTypes: ['candidate'] }), expect.anything()))
  })

  // Saving an edited id PUTs through putLink with the preset system.
  it('saves an edited external id through putLink', async () => {
    mockPutLink.mockResolvedValue(undefined)
    renderPanel()
    const input = await screen.findByRole('textbox', { name: t('integrations.links.columns.externalId') })
    await userEvent.clear(input)
    await userEvent.type(input, 'HF-9')
    await userEvent.click(screen.getByRole('button', { name: i18n.t('save', { ns: 'common' }) }))
    await waitFor(() => expect(mockPutLink).toHaveBeenCalledWith({ entity_type: 'candidate', entity_id: 'c1', system: 'helloflex', external_id: 'HF-9' }))
  })

  // A failed load shows the error caption.
  it('shows the load error', async () => {
    mockList.mockRejectedValue(new Error('x'))
    renderPanel()
    expect(await screen.findByText(t('integrations.links.loadError'))).toBeInTheDocument()
  })
})
