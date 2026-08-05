/**
 * WhatsAppLog · Koios conversation memory (days) — a tenant-setting number field
 * persisted through the generic /settings key/value store. Covers the seeded
 * default, reading back a stored value, the blur-commit save (§13: assert the
 * REQUEST), client-side range clamping, and revert + toast on a failed save.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import WhatsAppLog, { KOIOS_MEMORY_DAYS_KEY } from './WhatsAppLog'

const st = (key: string) => i18n.t(key, { ns: 'settings' })

// No WhatsApp messages needed for these cases — the log table itself is covered
// elsewhere; this file only exercises the settings field above it.
vi.mock('@/pages/whatsapp/hooks/useWhatsAppData', () => ({
  useWhatsAppData: () => ({ messages: [], loading: { messages: false } }),
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
