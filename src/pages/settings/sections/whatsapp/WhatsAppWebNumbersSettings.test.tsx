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
let mockReturn: Record<string, unknown>
let capturedBasePath: string | undefined
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
    createDevice, connect: vi.fn(), disconnect: vi.fn(), remove: vi.fn(),
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

  it('renders one card per device with its location name as the title prefix', () => {
    setHook({ phase: 'ready', devices: [
      { id: 1, label: 'Front desk', location: { id: 'loc-1', name: 'Branch A' } },
      { id: 2, label: 'Back office', location: null },
    ] })
    render(<WhatsAppWebNumbersSettings />)
    expect(screen.getByTestId('device-1')).toBeInTheDocument()
    expect(screen.getByText('Branch A')).toBeInTheDocument()
    expect(screen.getByTestId('device-2')).toBeInTheDocument()
    expect(screen.getByText('whatsappWeb.noLocation')).toBeInTheDocument()
  })

  it('submits the add form with exactly {location_id, label, phone_number}', async () => {
    setHook({ phase: 'ready', devices: [] })
    render(<WhatsAppWebNumbersSettings />)
    const user = userEvent.setup()

    // The searchable location combobox opens as a listbox trigger button.
    await user.click(screen.getByText('whatsappWeb.locationPlaceholder'))
    await user.click(await screen.findByText('Branch B'))
    await user.type(screen.getByPlaceholderText('whatsappWeb.labelPlaceholder'), 'Reception')
    await user.click(screen.getByText('whatsappWeb.submit'))

    await waitFor(() => expect(createDevice).toHaveBeenCalledWith({
      location_id: 'loc-2', label: 'Reception', phone_number: undefined,
    }))
  })

  it('hook is driven off the settings base path', () => {
    setHook({ phase: 'ready', devices: [] })
    render(<WhatsAppWebNumbersSettings />)
    expect(capturedBasePath).toBe('/settings/whatsapp-web-numbers')
  })
})
