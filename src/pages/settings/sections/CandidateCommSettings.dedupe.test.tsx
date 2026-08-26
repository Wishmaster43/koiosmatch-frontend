/**
 * CandidateCommSettings · Duplicate-detection fields (candidate_dedupe_keys) —
 * covers the seeded default, reading a stored set, checkbox toggle persisting
 * the full array (§13: assert the REQUEST), and revert + toast on failure.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { LastContactTypesSettings, DEDUPE_KEYS_KEY } from './CandidateCommSettings'

const st = (key: string) => i18n.t(key, { ns: 'settings' })

// StatusListEditor below the field fetches its own lookup list — stub that call
// so it never touches the network; this file only exercises the dedupe field.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(async () => ({ data: { rows: [] } })) },
  unwrap: (r: { data: unknown }) => r.data,
  unwrapList: (r: { data: unknown }) => r.data,
}))

// Controllable settings blob + a spy on the save path — keep the real
// getJsonSetting so the component's own read-back logic is exercised too.
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
const saveSettingsKeys = vi.hoisted(() => vi.fn(async () => {}))
const notifyError = vi.hoisted(() => vi.fn(() => {}))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return {
    ...actual,
    useAllSettings: () => mockSettings(),
    // STALE-INIT-1: this file's LastContactTypesSettings also renders the shared
    // NumberSettingField (NoContactDaysField) — every test here assumes the
    // settings blob has already resolved (the cold-cache case is covered by
    // NumberSettingField.test.tsx, the shared field's own regression test).
    useSettingsLoaded: () => true,
    saveSettingsKeys,
    invalidateAllSettingsCache: vi.fn(),
  }
})
vi.mock('@/lib/notify', () => ({ notifyError }))

afterEach(() => vi.clearAllMocks())

describe('CandidateCommSettings · dedupe keys — seeded default', () => {
  it('checks email + mobile, unchecks phone, when nothing is configured yet', () => {
    mockSettings.mockReturnValue({})
    render(<LastContactTypesSettings />)
    expect(screen.getByLabelText(st('lastContactTypes.dedupeKeys.email'))).toBeChecked()
    expect(screen.getByLabelText(st('lastContactTypes.dedupeKeys.mobile'))).toBeChecked()
    expect(screen.getByLabelText(st('lastContactTypes.dedupeKeys.phone'))).not.toBeChecked()
  })
})

describe('CandidateCommSettings · dedupe keys — reads a stored set', () => {
  it('reflects the stored array, not the default', () => {
    mockSettings.mockReturnValue({ [DEDUPE_KEYS_KEY]: JSON.stringify(['phone']) })
    render(<LastContactTypesSettings />)
    expect(screen.getByLabelText(st('lastContactTypes.dedupeKeys.email'))).not.toBeChecked()
    expect(screen.getByLabelText(st('lastContactTypes.dedupeKeys.phone'))).toBeChecked()
  })
})

describe('CandidateCommSettings · dedupe keys — toggle persists the full array', () => {
  it('adds phone to the default set and PUTs the resulting array', async () => {
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    render(<LastContactTypesSettings />)

    await user.click(screen.getByLabelText(st('lastContactTypes.dedupeKeys.phone')))

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ [DEDUPE_KEYS_KEY]: ['email', 'mobile', 'phone'] }))
  })

  it('removes email from the stored set on uncheck', async () => {
    mockSettings.mockReturnValue({ [DEDUPE_KEYS_KEY]: JSON.stringify(['email', 'mobile']) })
    const user = userEvent.setup()
    render(<LastContactTypesSettings />)

    await user.click(screen.getByLabelText(st('lastContactTypes.dedupeKeys.email')))

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ [DEDUPE_KEYS_KEY]: ['mobile'] }))
  })
})

describe('CandidateCommSettings · dedupe keys — save failure reverts', () => {
  it('reverts the checkbox and notifies on a failed save', async () => {
    mockSettings.mockReturnValue({})
    saveSettingsKeys.mockRejectedValueOnce(new Error('network down'))
    const user = userEvent.setup()
    render(<LastContactTypesSettings />)
    const phone = screen.getByLabelText(st('lastContactTypes.dedupeKeys.phone'))

    await user.click(phone)

    await waitFor(() => expect(phone).not.toBeChecked())
    expect(notifyError).toHaveBeenCalledWith(st('lastContactTypes.dedupeKeysSaveFailed'))
  })
})
