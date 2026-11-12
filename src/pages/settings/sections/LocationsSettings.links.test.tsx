/** LocationsSettings connector columns (VESTIGINGEN-LINKS-FE-1): visibility, GET/PUT seam, failure paths. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import api from '@/lib/api'
import LocationsSettings from './LocationsSettings'

// Every render gets its own QueryClient (the connector columns read through react-query).
const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LocationsSettings /></QueryClientProvider>)

const mockedApi = vi.mocked(api, true)
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
const mockModules = vi.hoisted(() => ({ on: new Set<string>(), perms: new Set<string>(['settings.update']) }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ hasModule: (k: string) => mockModules.on.has(k), hasPermission: (k: string) => mockModules.perms.has(k) }),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const st = (key: string) => i18n.t(key, { ns: 'settings' })
const ct = (key: string) => i18n.t(key, { ns: 'common' })
const NAME = 'Kantoor Rotterdam'
const cellName = (col: string) => `${NAME} · ${st(col)}`
const location = () => ({
  id: 'loc1', name: 'Kantoor Rotterdam', street: 'Coolsingel', house_number: '1', postal_code: '3011AD', city: 'Rotterdam',
  address: 'Coolsingel 1, 3011AD Rotterdam', created_at: '2026-07-01T10:00:00Z', in_use: false,
})
afterEach(() => { vi.clearAllMocks(); mockModules.on.clear(); mockModules.perms.clear(); mockModules.perms.add('settings.update') })

describe('LocationsSettings connector columns', () => {
  it('VESTIGINGEN-LINKS-FE-1: the connector columns are absent when both modules are off', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [location()] } })
    renderPage()
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())
    expect(screen.queryByText(st('locations.colHelloflex'))).not.toBeInTheDocument()
    expect(screen.queryByText(st('locations.colShiftmanager'))).not.toBeInTheDocument()
    expect(mockedApi.get).not.toHaveBeenCalledWith('/external-id-mappings', expect.anything())
  })

  it('VESTIGINGEN-LINKS-FE-1: with hf on, only the HelloFlex column shows and its save PUTs hf_id', async () => {
    mockModules.on.add('hf')
    mockedApi.get.mockImplementation((path) => Promise.resolve(path === '/external-id-mappings'
      ? { data: { data: { hf_id: null, hf_status: 'unlinked', sm_id: null } } }
      : { data: { data: [location()] } }))
    mockedApi.put.mockResolvedValue({ data: {} })
    const { notifySuccess } = await import('@/lib/notify')
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())
    expect(screen.getByText(st('locations.colHelloflex'))).toBeInTheDocument()
    expect(screen.queryByText(st('locations.colShiftmanager'))).not.toBeInTheDocument()
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/external-id-mappings',
      expect.objectContaining({ params: { entity_type: 'branch', entity_id: 'loc1' } })))

    await user.type(screen.getByLabelText(cellName('locations.colHelloflex')), ' guid-9 ')
    await user.click(screen.getByRole('button', { name: `${ct('save')} ${cellName('locations.colHelloflex')}` }))
    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith('/external-id-mappings',
      { entity_type: 'branch', entity_id: 'loc1', hf_id: 'guid-9' }))
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith(st('locations.linkSaved')))
  })

  it('a settings.view-only user gets no connector columns and no mapping requests', async () => {
    mockModules.on.add('hf')
    mockModules.perms.clear()
    mockModules.perms.add('settings.view')
    mockedApi.get.mockResolvedValue({ data: { data: [location()] } })
    renderPage()
    await waitFor(() => expect(screen.getByText(NAME)).toBeInTheDocument())
    expect(screen.queryByText(st('locations.colHelloflex'))).not.toBeInTheDocument()
    expect(mockedApi.get).not.toHaveBeenCalledWith('/external-id-mappings', expect.anything())
    expect(screen.queryByText(st('locations.linksLoadFailed'))).not.toBeInTheDocument()
  })

  it('a failed PUT toasts the link-specific error and keeps the draft', async () => {
    mockModules.on.add('hf')
    mockedApi.get.mockImplementation((path) => Promise.resolve(path === '/external-id-mappings'
      ? { data: { data: { hf_id: null, sm_id: null } } } : { data: { data: [location()] } }))
    mockedApi.put.mockRejectedValue(new Error('nope'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())
    await user.type(await screen.findByLabelText(cellName('locations.colHelloflex')), 'guid-1')
    await user.click(screen.getByRole('button', { name: `${ct('save')} ${cellName('locations.colHelloflex')}` }))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('locations.linkSaveFailed')))
    expect(screen.getByLabelText(cellName('locations.colHelloflex'))).toHaveValue('guid-1')
  })

  it('a failed mapping read shows one error banner instead of silent empty cells', async () => {
    mockModules.on.add('hf')
    mockedApi.get.mockImplementation((path) => path === '/external-id-mappings'
      ? Promise.reject(new Error('down')) : Promise.resolve({ data: { data: [location()] } }))
    renderPage()
    expect(await screen.findByText(st('locations.linksLoadFailed'))).toBeInTheDocument()
  })
})
