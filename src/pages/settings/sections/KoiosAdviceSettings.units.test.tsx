/** KoiosAdviceSettings · units and per-phase table (split from KoiosAdviceSettings.test.tsx; application-stage and match-renewal unit pickers, save-failure revert, embedded suggestions group, per-phase window table). */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import KoiosAdviceSettings, {
  MATCH_ADVICE_RENEW_DAYS_KEY, APPLICATION_STAGE_STALE_DAYS_UNIT_KEY, APPLICATION_STAGE_STALE_BY_PHASE_KEY,
} from './KoiosAdviceSettings'

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
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { ...actual.default, get: vi.fn(async () => ({ data: {} })), post: vi.fn(async () => ({ data: {} })) } }
})
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
// SETTINGS-UNIT-PAIRS-1: whether the per-phase table renders is decided by this
// stubbed catalogue — mutate `catalogSections` per test to switch the feature on/off.
let catalogSections: Array<{ id: string; keys: Array<Record<string, unknown>> }> = [{ id: 'windows', keys: [
  { key: 'koios_suggest_max', section: 'windows', type: 'integer', rules: ['integer', 'min:1', 'max:50'], default: 10, aliases: [],
    label_key: 'settings.windows.koios_suggest_max.label', ui: 'generic', fe_screen: 'windows', constraints: { min: 1, max: 50 },
    group: 'koios_suggest', group_label_key: 'settings.groups.koios_suggest' },
] }]
// KOIOS-SUGGEST-COMPACT-2: the "Koios suggests" switches/windows are catalogue rows
// (section windows, group koios_suggest) embedded on this screen — the catalogue hook is
// stubbed with one row of that group so the embed's presence is provable without the API.
vi.mock('@/pages/settings/catalog/useSettingsCatalog', () => ({
  useSettingsCatalog: () => ({ isLoading: false, isError: false, refetch: vi.fn(), sections: catalogSections }),
}))

afterEach(() => { vi.clearAllMocks(); catalogSections = [{ id: 'windows', keys: [
  { key: 'koios_suggest_max', section: 'windows', type: 'integer', rules: ['integer', 'min:1', 'max:50'], default: 10, aliases: [],
    label_key: 'settings.windows.koios_suggest_max.label', ui: 'generic', fe_screen: 'windows', constraints: { min: 1, max: 50 },
    group: 'koios_suggest', group_label_key: 'settings.groups.koios_suggest' },
] }] })

// useSettingsCatalog() runs unconditionally now (the feature-detection memo), so
// every render needs a QueryClientProvider, not just the sub-tab tests.
const renderKAS = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(<QueryClientProvider client={client}><KoiosAdviceSettings /></QueryClientProvider>)
  // The mocked useAllSettings is a plain function, not subscribable React state, so
  // a test chaining two persisted edits needs to force a re-render after updating the
  // mocked return value, or the second edit would still read the first edit's stale map.
  const rerenderKAS = () => utils.rerender(<QueryClientProvider client={client}><KoiosAdviceSettings /></QueryClientProvider>)
  return { ...utils, rerenderKAS }
}

// SETTINGS-UNIT-PAIRS-1: the application-stage window gets the same inline unit
// picker as the vacancy one, built from the same shared WindowUnitField.
describe('KoiosAdviceSettings — application-stage unit picker', () => {
  it('persists a chosen unit under application_stage_stale_days_unit', async () => {
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    renderKAS()
    await user.click(screen.getByRole('button', { name: st('settings.windows.application_stage_stale_days_unit.label') }))
    await user.click(await screen.findByText(st('settings.options.window_unit.workdays')))

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ [APPLICATION_STAGE_STALE_DAYS_UNIT_KEY]: 'workdays' }))
  })
})

// WINDOW-UNIT-READERS-1: the match-renewal unit picker renders only once the
// BE catalogue lists match_advice_renew_days_unit (feature detection — an
// older BE has no such row yet and must render exactly as before then).
describe('KoiosAdviceSettings — match renewal unit picker (WINDOW-UNIT-READERS-1)', () => {
  it('renders no unit picker when the catalogue lacks the key', () => {
    mockSettings.mockReturnValue({})
    renderKAS()
    expect(screen.queryByRole('button', { name: st('settings.windows.match_advice_renew_days_unit.label') })).not.toBeInTheDocument()
  })

  it('renders the unit picker once the catalogue lists the key, and persists a chosen unit', async () => {
    catalogSections = [{ id: 'windows', keys: [
      { key: 'match_advice_renew_days_unit', section: 'windows', type: 'select', default: 'days', aliases: [],
        label_key: 'settings.windows.match_advice_renew_days_unit.label', ui: 'generic', fe_screen: 'windows' },
    ] }]
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    renderKAS()
    await user.click(screen.getByRole('button', { name: st('settings.windows.match_advice_renew_days_unit.label') }))
    await user.click(await screen.findByText(st('settings.options.window_unit.weeks')))

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ match_advice_renew_days_unit: 'weeks' }))
  })
})

describe('KoiosAdviceSettings — save failure reverts', () => {
  it('reverts the match field and notifies on a failed save', async () => {
    mockSettings.mockReturnValue({ [MATCH_ADVICE_RENEW_DAYS_KEY]: 30 })
    saveSettingsKeys.mockRejectedValueOnce(new Error('network down'))
    const user = userEvent.setup()
    renderKAS()
    const input = document.getElementById('match-advice-renew-days')!

    await user.clear(input)
    await user.type(input, '45')
    await user.tab()

    await waitFor(() => expect(input).toHaveValue(30))
    expect(notifyError).toHaveBeenCalledWith(st('koiosAdvice.matchRenewSaveFailed'))
  })
})

// KOIOS-SUGGEST-COMPACT-2 (Danny 28-09): the suggestions group renders on this screen,
// headed by its own group label, so the thresholds the assistant reads sit beside the advice ones.
describe('KoiosAdviceSettings — embedded koios_suggest catalogue group', () => {
  it('renders the suggestions group with its label next to the advice thresholds', async () => {
    mockSettings.mockReturnValue({})
    renderKAS()
    await userEvent.click(await screen.findByRole('tab', { name: st('koiosAdvice.tabs.suggestions') }))
    expect(await screen.findByText(st('settings.windows.koios_suggest_max.label'))).toBeInTheDocument()
    expect(screen.getAllByText(st('settings.groups.koios_suggest')).length).toBeGreaterThanOrEqual(2)
  })
})

// STAGE-STALE-PER-PHASE-1: the per-phase override table only renders once the
// catalogue carries `application_stage_stale_by_phase` (older BE renders nothing here).
describe('KoiosAdviceSettings — per-phase table (STAGE-STALE-PER-PHASE-1)', () => {
  it('renders no per-phase table when the catalogue lacks the key', () => {
    mockSettings.mockReturnValue({})
    renderKAS()
    expect(screen.queryByText(st('koiosAdvice.byPhaseTitle'))).not.toBeInTheDocument()
  })

  it('renders one row per application stage and posts a per-stage edit as one JSON string', async () => {
    catalogSections = [{ id: 'windows', keys: [
      { key: 'application_stage_stale_by_phase', section: 'windows', type: 'json', rules: [], default: null, aliases: [],
        label_key: 'settings.windows.application_stage_stale_by_phase.label', ui: 'dedicated', fe_screen: null, format: 'stage_window_map' },
    ] }]
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    renderKAS()
    const heading = await screen.findByText(st('koiosAdvice.byPhaseTitle'))
    const tableContainer = heading.parentElement!
    // The first stage row's amount input — the seeded stages render in their catalogue
    // order, so this is the first application stage ("applied").
    const amountInput = tableContainer.querySelectorAll('input')[0]
    await user.clear(amountInput)
    await user.type(amountInput, '3')
    await user.tab()

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith(
      { [APPLICATION_STAGE_STALE_BY_PHASE_KEY]: { applied: { amount: 3, unit: 'days' } } },
    ))
    // Commit-on-blur only (§13): the amount must persist once, never per keystroke.
    expect(saveSettingsKeys).toHaveBeenCalledTimes(1)
  })

  it('shows the "reset to default" ghost button only for an overridden stage', async () => {
    catalogSections = [{ id: 'windows', keys: [
      { key: 'application_stage_stale_by_phase', section: 'windows', type: 'json', rules: [], default: null, aliases: [],
        label_key: 'settings.windows.application_stage_stale_by_phase.label', ui: 'dedicated', fe_screen: null, format: 'stage_window_map' },
    ] }]
    mockSettings.mockReturnValue({ [APPLICATION_STAGE_STALE_BY_PHASE_KEY]: JSON.stringify({ invited: { amount: 3, unit: 'workdays' } }) })
    renderKAS()
    expect(await screen.findByText(st('koiosAdvice.byPhaseTitle'))).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: st('koiosAdvice.byPhaseReset') })).toHaveLength(1)
  })

  // Clicking reset on the one overridden stage must persist the map WITHOUT that
  // stage's entry (an empty map here, since 'invited' was the only override).
  it('clicking "Standaard gebruiken" persists the map minus that stage', async () => {
    catalogSections = [{ id: 'windows', keys: [
      { key: 'application_stage_stale_by_phase', section: 'windows', type: 'json', rules: [], default: null, aliases: [],
        label_key: 'settings.windows.application_stage_stale_by_phase.label', ui: 'dedicated', fe_screen: null, format: 'stage_window_map' },
    ] }]
    mockSettings.mockReturnValue({ [APPLICATION_STAGE_STALE_BY_PHASE_KEY]: JSON.stringify({ invited: { amount: 3, unit: 'workdays' } }) })
    const user = userEvent.setup()
    renderKAS()
    await screen.findByText(st('koiosAdvice.byPhaseTitle'))
    await user.click(screen.getByRole('button', { name: st('koiosAdvice.byPhaseReset') }))

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ [APPLICATION_STAGE_STALE_BY_PHASE_KEY]: {} }))
  })

  // A rejected write is SAID, never swallowed (ADVICE-UNIT-FEEDBACK-1) — and the row
  // shows the previous (last-confirmed) value again, not the failed edit.
  it('notifies and reverts the row when the per-stage save is rejected', async () => {
    catalogSections = [{ id: 'windows', keys: [
      { key: 'application_stage_stale_by_phase', section: 'windows', type: 'json', rules: [], default: null, aliases: [],
        label_key: 'settings.windows.application_stage_stale_by_phase.label', ui: 'dedicated', fe_screen: null, format: 'stage_window_map' },
    ] }]
    mockSettings.mockReturnValue({})
    saveSettingsKeys.mockRejectedValueOnce(new Error('network down'))
    const user = userEvent.setup()
    renderKAS()
    const heading = await screen.findByText(st('koiosAdvice.byPhaseTitle'))
    const tableContainer = heading.parentElement!
    const amountInput = tableContainer.querySelectorAll('input')[0]

    await user.clear(amountInput)
    await user.type(amountInput, '3')
    await user.tab()

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('koiosAdvice.byPhaseSaveFailed')))
    // The failed-save revert remounts the field (fresh DOM node) so its display resets
    // to the last-confirmed value — re-query rather than assert on the stale reference.
    // The field is a text input (locale-formatted), so the expected value is a string.
    await waitFor(() => expect(tableContainer.querySelectorAll('input')[0]).toHaveValue('14'))
  })

  // The brief's own case: setting Intake ("invited") to 3 workdays — amount commit
  // (blur) followed by a unit pick — must post EXACTLY that map, once, no per-keystroke calls.
  it('setting Intake to 3 workdays posts exactly that map, once', async () => {
    catalogSections = [{ id: 'windows', keys: [
      { key: 'application_stage_stale_by_phase', section: 'windows', type: 'json', rules: [], default: null, aliases: [],
        label_key: 'settings.windows.application_stage_stale_by_phase.label', ui: 'dedicated', fe_screen: null, format: 'stage_window_map' },
    ] }]
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    const { rerenderKAS } = renderKAS()
    const heading = await screen.findByText(st('koiosAdvice.byPhaseTitle'))
    let tableContainer = heading.parentElement!
    // The seeded stages render in catalogue order: applied, invited(Intake), proposal, hired, rejected.
    const amountInput = tableContainer.querySelectorAll('input')[1]

    await user.clear(amountInput)
    await user.type(amountInput, '3')
    await user.tab()
    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith(
      { [APPLICATION_STAGE_STALE_BY_PHASE_KEY]: { invited: { amount: 3, unit: 'days' } } },
    ))
    expect(saveSettingsKeys).toHaveBeenCalledTimes(1)

    // The mocked settings cache does not update itself (it is a plain function, not
    // subscribable state) — reflect the just-persisted map and force a re-render, the
    // same effect the real cache's invalidate+refetch has, so the second edit (the
    // unit) reads the amount the first edit just committed, not the stale fallback.
    mockSettings.mockReturnValue({ [APPLICATION_STAGE_STALE_BY_PHASE_KEY]: JSON.stringify({ invited: { amount: 3, unit: 'days' } }) })
    rerenderKAS()
    tableContainer = (await screen.findByText(st('koiosAdvice.byPhaseTitle'))).parentElement!
    const unitButtons = tableContainer.querySelectorAll('button')
    await user.click(unitButtons[1])
    await user.click(await screen.findByText(st('settings.options.window_unit.workdays')))

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenLastCalledWith(
      { [APPLICATION_STAGE_STALE_BY_PHASE_KEY]: { invited: { amount: 3, unit: 'workdays' } } },
    ))
  })
})
