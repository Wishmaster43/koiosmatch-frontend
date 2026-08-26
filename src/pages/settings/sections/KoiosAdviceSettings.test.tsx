/**
 * KoiosAdviceSettings — the two tenant-setting number fields behind the "Koios"
 * attention column (vacancy staleness + match renewal window). Covers the
 * seeded defaults, reading back stored values, the blur-commit save (§13:
 * assert the REQUEST), client-side range clamping, and revert + toast on a
 * failed save. Mirrors WhatsAppLog.test.tsx's ConversationMemoryField coverage.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import KoiosAdviceSettings, { VACANCY_ADVICE_STALE_DAYS_KEY, MATCH_ADVICE_RENEW_DAYS_KEY, APPLICATION_STAGE_STALE_DAYS_KEY } from './KoiosAdviceSettings'

const st = (key: string) => i18n.t(key, { ns: 'settings' })

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

describe('KoiosAdviceSettings — seeded defaults', () => {
  it('shows the 14-day vacancy default, 30-day match default and 14-day application-stage default when nothing is configured', () => {
    mockSettings.mockReturnValue({})
    render(<KoiosAdviceSettings />)
    expect(document.getElementById('vacancy-advice-stale-days')!).toHaveValue(14)
    expect(document.getElementById('match-advice-renew-days')!).toHaveValue(30)
    expect(document.getElementById('application-stage-stale-days')!).toHaveValue(14)
  })
})

describe('KoiosAdviceSettings — reads stored values', () => {
  it('shows the stored day counts, not the defaults', () => {
    mockSettings.mockReturnValue({ [VACANCY_ADVICE_STALE_DAYS_KEY]: 21, [MATCH_ADVICE_RENEW_DAYS_KEY]: 60, [APPLICATION_STAGE_STALE_DAYS_KEY]: 7 })
    render(<KoiosAdviceSettings />)
    expect(document.getElementById('vacancy-advice-stale-days')!).toHaveValue(21)
    expect(document.getElementById('match-advice-renew-days')!).toHaveValue(60)
    expect(document.getElementById('application-stage-stale-days')!).toHaveValue(7)
  })
})

describe('KoiosAdviceSettings — saves on blur', () => {
  it('persists the new vacancy stale window under vacancy_advice_stale_days on blur', async () => {
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    render(<KoiosAdviceSettings />)
    const input = document.getElementById('vacancy-advice-stale-days')!

    await user.clear(input)
    await user.type(input, '21')
    await user.tab()

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ [VACANCY_ADVICE_STALE_DAYS_KEY]: 21 }))
  })

  it('persists the new match renewal window under match_advice_renew_days on blur', async () => {
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    render(<KoiosAdviceSettings />)
    const input = document.getElementById('match-advice-renew-days')!

    await user.clear(input)
    await user.type(input, '45')
    await user.tab()

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ [MATCH_ADVICE_RENEW_DAYS_KEY]: 45 }))
  })

  it('clamps an out-of-range vacancy value to 365 before persisting', async () => {
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    render(<KoiosAdviceSettings />)
    const input = document.getElementById('vacancy-advice-stale-days')!

    await user.clear(input)
    await user.type(input, '9999')
    await user.tab()

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ [VACANCY_ADVICE_STALE_DAYS_KEY]: 365 }))
  })

  it('persists the new application stage staleness window under application_stage_stale_days on blur', async () => {
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    render(<KoiosAdviceSettings />)
    const input = document.getElementById('application-stage-stale-days')!

    await user.clear(input)
    await user.type(input, '5')
    await user.tab()

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ [APPLICATION_STAGE_STALE_DAYS_KEY]: 5 }))
  })
})

describe('KoiosAdviceSettings — save failure reverts', () => {
  it('reverts the match field and notifies on a failed save', async () => {
    mockSettings.mockReturnValue({ [MATCH_ADVICE_RENEW_DAYS_KEY]: 30 })
    saveSettingsKeys.mockRejectedValueOnce(new Error('network down'))
    const user = userEvent.setup()
    render(<KoiosAdviceSettings />)
    const input = document.getElementById('match-advice-renew-days')!

    await user.clear(input)
    await user.type(input, '45')
    await user.tab()

    await waitFor(() => expect(input).toHaveValue(30))
    expect(notifyError).toHaveBeenCalledWith(st('koiosAdvice.matchRenewSaveFailed'))
  })
})
