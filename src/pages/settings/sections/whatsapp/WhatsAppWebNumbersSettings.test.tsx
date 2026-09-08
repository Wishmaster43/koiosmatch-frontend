/**
 * WhatsAppWebNumbersSettings — K-195 seam coverage: the four UI states, the
 * add-form's exact POST body (§13: assert the request, not a fired callback),
 * and the 501/unavailable notice paths via the shared useWhatsAppWeb hook.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WhatsAppWebNumbersSettings from './WhatsAppWebNumbersSettings'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'loc-1', label: 'Branch A' }, { value: 'loc-2', label: 'Branch B' }],
}))
// The device card is unit-tested on its own (WhatsAppWebDevice.test.tsx), and
// useWhatsAppWeb has its own contract test; the shared device machinery lives in
// components/whatsappWeb (not an entity barrel: a barrel loads eagerly and would
// drag @/lib/datetime + the i18n init into every consumer's test tree).
const createDevice = vi.fn()
const updateDevice = vi.fn()
let mockReturn: Record<string, unknown>
let capturedBasePath: string | undefined
vi.mock('@/components/whatsappWeb/useWhatsAppWebHealth', () => ({ useWhatsAppWebHealth: () => ({ gateway: null, gatewayDown: false, loading: false }) }))
vi.mock('@/components/whatsappWeb/useWhatsAppWeb', () => ({
  useWhatsAppWeb: (basePath: string) => { capturedBasePath = basePath; return mockReturn },
}))
vi.mock('@/components/whatsappWeb/WhatsAppWebDevice', () => ({
  default: ({ device }: { device: { id: number; label: string | null } }) => <div data-testid={`device-${device.id}`}>{device.label}</div>,
}))
// The queue-limits card ships its own test file; stub it out so this file's
// network mocks stay scoped to /settings/whatsapp-web-numbers.
vi.mock('./WaWebQueueLimits', () => ({ default: () => <div data-testid="queue-limits" /> }))

function setHook(overrides: Record<string, unknown>) {
  mockReturn = {
    devices: [], phase: 'ready', busyId: null, notEnabledId: null,
    createDevice, updateDevice, connect: vi.fn(), disconnect: vi.fn(), remove: vi.fn(),
    ...overrides,
  }
}

describe('WhatsAppWebNumbersSettings', () => {
  beforeEach(() => { createDevice.mockReset(); createDevice.mockResolvedValue(undefined) })

  it('loading state', () => {
    setHook({ phase: 'loading' })
    render(<WhatsAppWebNumbersSettings />)
    expect(screen.getByText('whatsappWeb.loading')).toBeInTheDocument()
  })

  it('unavailable state (module/permission off)', () => {
    setHook({ phase: 'unavailable' })
    render(<WhatsAppWebNumbersSettings />)
    expect(screen.getByText('whatsappWeb.unavailable')).toBeInTheDocument()
  })

  it('error state', () => {
    setHook({ phase: 'error' })
    render(<WhatsAppWebNumbersSettings />)
    expect(screen.getByText('whatsappWeb.error')).toBeInTheDocument()
  })

  it('empty state when ready with no rows', () => {
    setHook({ phase: 'ready', devices: [] })
    render(<WhatsAppWebNumbersSettings />)
    expect(screen.getByText('whatsappWeb.empty')).toBeInTheDocument()
  })

  // WA-WEB-BRANCHES-1: a row reads `locations[]` (never the deprecated singular).
  it('renders one card per device with its served branch names, comma-joined, as the title prefix', () => {
    setHook({ phase: 'ready', devices: [
      { id: 1, label: 'Front desk', locations: [{ id: 'loc-1', name: 'Branch A' }, { id: 'loc-2', name: 'Branch B' }] },
      { id: 2, label: 'Back office', locations: [], location: { id: 'loc-9', name: 'Stale singular' } },
    ] })
    render(<WhatsAppWebNumbersSettings />)
    expect(screen.getByTestId('device-1')).toBeInTheDocument()
    expect(screen.getByText('Branch A, Branch B')).toBeInTheDocument()
    expect(screen.getByTestId('device-2')).toBeInTheDocument()
    expect(screen.getByText('whatsappWeb.noLocation')).toBeInTheDocument()
    expect(screen.queryByText('Stale singular')).toBeNull()
  })

  it('submits the add form with exactly {location_ids[], label, phone_number} and refuses an empty branch set', async () => {
    setHook({ phase: 'ready', devices: [] })
    render(<WhatsAppWebNumbersSettings />)
    const user = userEvent.setup()

    // No branch picked yet: the hint shows and the submit stays disabled (the server 422s an empty set).
    expect(screen.getByText('whatsappWeb.locationsRequired')).toBeInTheDocument()
    expect(screen.getByText('whatsappWeb.submit').closest('button')).toBeDisabled()

    // The branch picker is the house chip multi-select: two picks = two ids.
    await user.click(screen.getByRole('button', { name: 'Branch B' }))
    await user.click(screen.getByRole('button', { name: 'Branch A' }))
    await user.type(screen.getByPlaceholderText('whatsappWeb.labelPlaceholder'), 'Reception')
    await user.click(screen.getByText('whatsappWeb.submit'))

    await waitFor(() => expect(createDevice).toHaveBeenCalledWith({
      location_ids: ['loc-2', 'loc-1'], label: 'Reception', phone_number: undefined,
    }))
  })

  it('the row pencil opens the branch editor seeded with the served set and PATCHes the full new set', async () => {
    updateDevice.mockResolvedValue(true)
    setHook({ phase: 'ready', devices: [
      { id: 1, label: 'Front desk', locations: [{ id: 'loc-1', name: 'Branch A' }] },
    ] })
    render(<WhatsAppWebNumbersSettings />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'whatsappWeb.editLocations' }))
    // Seeded: Branch A already pressed inside the editor (the add form below has its own, unpressed, copy).
    const pressed = screen.getAllByRole('button', { name: 'Branch A', pressed: true })
    expect(pressed).toHaveLength(1)
    await user.click(screen.getAllByRole('button', { name: 'Branch B' })[0])
    await user.click(screen.getByText('whatsappWeb.saveLocations'))

    await waitFor(() => expect(updateDevice).toHaveBeenCalledWith(1, { location_ids: ['loc-1', 'loc-2'] }))
    // A landed PATCH closes the editor again.
    await waitFor(() => expect(screen.queryByText('whatsappWeb.saveLocations')).toBeNull())
  })

  it('a failed branch PATCH keeps the editor open and reports it', async () => {
    updateDevice.mockResolvedValue(false)
    setHook({ phase: 'ready', devices: [
      { id: 1, label: 'Front desk', locations: [{ id: 'loc-1', name: 'Branch A' }] },
    ] })
    render(<WhatsAppWebNumbersSettings />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'whatsappWeb.editLocations' }))
    await user.click(screen.getAllByRole('button', { name: 'Branch B' })[0])
    await user.click(screen.getByText('whatsappWeb.saveLocations'))

    expect(await screen.findByText('whatsappWeb.updateError')).toBeInTheDocument()
    expect(screen.getByText('whatsappWeb.saveLocations')).toBeInTheDocument()
  })

  it('hook is driven off the settings base path', () => {
    setHook({ phase: 'ready', devices: [] })
    render(<WhatsAppWebNumbersSettings />)
    expect(capturedBasePath).toBe('/settings/whatsapp-web-numbers')
  })
})
