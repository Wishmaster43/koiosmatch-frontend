/**
 * WhatsAppLog · Koios conversation memory (days) — a tenant-setting number field
 * persisted through the generic /settings key/value store. Covers the seeded
 * default, reading back a stored value, the blur-commit save (§13: assert the
 * REQUEST), client-side range clamping, and revert + toast on a failed save.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import WhatsAppLog, { KOIOS_MEMORY_DAYS_KEY } from './WhatsAppLog'

const st = (key: string) => i18n.t(key, { ns: 'settings' })

// No WhatsApp messages needed for these cases — the log table itself is covered
// elsewhere; this file only exercises the settings field above it. Captures the
// filters arg so the WA-MSG-TABLE-1 stage B tests below can assert the request.
const waDataFixture = () => ({
  messages: [] as unknown[], loading: { messages: false },
  loadMoreMessages: vi.fn(), loadingMoreMessages: false, messagesExhausted: false,
})
const mockUseWhatsAppData: (filters?: unknown) => ReturnType<typeof waDataFixture> = vi.fn(waDataFixture)
vi.mock('@/pages/whatsapp/hooks/useWhatsAppData', () => ({
  useWhatsAppData: (filters?: unknown) => mockUseWhatsAppData(filters),
}))

// Captures every registerFilters call (LogView → RightPanelContext) so a test
// can drive the SAME onToggle a right-panel row would call.
interface FilterGroup { key: string; onToggle?: (v: string) => void }
let lastLogGroups: FilterGroup[] = []
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({
    registerFilters: (_key: string, groups: FilterGroup[]) => { lastLogGroups = groups },
    unregisterFilters: () => {},
  }),
}))

// Controllable settings blob + a spy on the save path — keep the real
// getNumberSetting so the component's own read-back logic is exercised too.
// vi.hoisted: vi.mock factories run before these const declarations otherwise (TDZ).
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
const saveSettingsKeys = vi.hoisted(() => vi.fn(async () => {}))
const notifyError = vi.hoisted(() => vi.fn(() => {}))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return {
    ...actual,
    useAllSettings: () => mockSettings(),
    // STALE-INIT-1: every test here assumes the settings blob has already
    // resolved (the cold-cache/disabled-until-loaded case is covered by
    // NumberSettingField.test.tsx, the shared field's own regression test).
    useSettingsLoaded: () => true,
    saveSettingsKeys,
    invalidateAllSettingsCache: vi.fn(),
  }
})
vi.mock('@/lib/notify', () => ({ notifyError }))

afterEach(() => vi.clearAllMocks())

describe('WhatsAppLog · Koios conversation memory — seeded default', () => {
  it('shows the 90-day default when nothing is configured yet', () => {
    mockSettings.mockReturnValue({})
    render(<WhatsAppLog />)
    expect(screen.getByLabelText(st('waLog.memoryDaysLabel'))).toHaveValue(90)
  })
})

describe('WhatsAppLog · Koios conversation memory — reads a stored value', () => {
  it('shows the stored day count, not the default', () => {
    mockSettings.mockReturnValue({ [KOIOS_MEMORY_DAYS_KEY]: 30 })
    render(<WhatsAppLog />)
    expect(screen.getByLabelText(st('waLog.memoryDaysLabel'))).toHaveValue(30)
  })
})

describe('WhatsAppLog · Koios conversation memory — saves on blur', () => {
  it('persists the new value under koios_conversation_memory_days on blur', async () => {
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    render(<WhatsAppLog />)
    const input = screen.getByLabelText(st('waLog.memoryDaysLabel'))

    await user.clear(input)
    await user.type(input, '45')
    await user.tab()

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ [KOIOS_MEMORY_DAYS_KEY]: 45 }))
  })

  it('clamps an out-of-range value to 365 before persisting', async () => {
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    render(<WhatsAppLog />)
    const input = screen.getByLabelText(st('waLog.memoryDaysLabel'))

    await user.clear(input)
    await user.type(input, '9999')
    await user.tab()

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ [KOIOS_MEMORY_DAYS_KEY]: 365 }))
  })
})

describe('WhatsAppLog · Koios conversation memory — save failure reverts', () => {
  it('reverts the field and notifies on a failed save', async () => {
    mockSettings.mockReturnValue({ [KOIOS_MEMORY_DAYS_KEY]: 90 })
    saveSettingsKeys.mockRejectedValueOnce(new Error('network down'))
    const user = userEvent.setup()
    render(<WhatsAppLog />)
    const input = screen.getByLabelText(st('waLog.memoryDaysLabel'))

    await user.clear(input)
    await user.type(input, '45')
    await user.tab()

    await waitFor(() => expect(input).toHaveValue(90))
    expect(notifyError).toHaveBeenCalledWith(st('waLog.memoryDaysSaveFailed'))
  })
})

// WA-MSG-TABLE-1 stage B: the log's own direction/status filters are now real
// server params on the SAME useWhatsAppData hook (§13: assert the request).
describe('WhatsAppLog · direction/status reach the request (WA-MSG-TABLE-1 stage B)', () => {
  it('picking a direction sends it to useWhatsAppData as a scalar direction filter', async () => {
    mockSettings.mockReturnValue({})
    render(<WhatsAppLog />)
    const directionGroup = lastLogGroups.find(g => g.key === 'direction')!
    act(() => { directionGroup.onToggle!('out') })
    await waitFor(() => expect(mockUseWhatsAppData).toHaveBeenLastCalledWith(
      expect.objectContaining({ direction: ['outbound'] }),
    ))
  })

  it('picking a status sends it to useWhatsAppData as a status filter', async () => {
    mockSettings.mockReturnValue({})
    render(<WhatsAppLog />)
    const statusGroup = lastLogGroups.find(g => g.key === 'status')!
    act(() => { statusGroup.onToggle!('failed') })
    await waitFor(() => expect(mockUseWhatsAppData).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: ['failed'] }),
    ))
  })

  it('re-picking the same direction clears the filter (single-select toggle)', async () => {
    mockSettings.mockReturnValue({})
    render(<WhatsAppLog />)
    act(() => { lastLogGroups.find(g => g.key === 'direction')!.onToggle!('in') })
    await waitFor(() => expect(mockUseWhatsAppData).toHaveBeenLastCalledWith(
      expect.objectContaining({ direction: ['inbound'] }),
    ))
    act(() => { lastLogGroups.find(g => g.key === 'direction')!.onToggle!('in') })
    // Toggling off drops the group's selection to empty; WhatsAppLog then
    // omits the param entirely (`undefined`), same as the panel's other groups.
    await waitFor(() => expect(mockUseWhatsAppData).toHaveBeenLastCalledWith(
      expect.objectContaining({ direction: undefined }),
    ))
  })
})
