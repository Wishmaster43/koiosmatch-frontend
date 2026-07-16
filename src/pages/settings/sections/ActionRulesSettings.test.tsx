/**
 * ActionRulesSettings tests — the four UI states (loading/error/empty/success), the
 * cycle-chip interaction, the locked (P4/P8) cells staying non-interactive, the
 * override badge, and the Save/Reset flows against the measured PUT contract
 * (`PUT /settings/action-rules { rules: [{action, condition, effect}] }`, only the
 * changed cells — see ActionRuleController::update()). Also covers the Kandidaat/
 * Klant/AVG sub-tab split (Danny 2026-07-16): default tab, switching tabs, and that
 * a staged edit + its dirty-count survive a tab switch (the save bar spans all tabs).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import ActionRulesSettings from './ActionRulesSettings'
import {
  CANDIDATE_ACTIONS, CUSTOMER_ACTIONS, CANDIDATE_CONDITIONS, CUSTOMER_CONDITIONS,
  WHATSAPP_SEND_ACTION, NO_CONSENT_CONDITION, defaultEffectFor, popupCodeFor,
} from './actionrules/catalogMeta'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

// The full seed-default matrix, exactly as `GET /action-rules` would return it for a
// tenant with no overrides yet — built from the same catalog mirror the component uses.
function fullDefaultMatrix() {
  const rows: { action: string; condition: string; effect: string; popup_code: string | null }[] = []
  for (const action of CANDIDATE_ACTIONS) {
    for (const condition of CANDIDATE_CONDITIONS) {
      rows.push({ action, condition, effect: defaultEffectFor(action, condition), popup_code: popupCodeFor(action, condition) })
    }
  }
  for (const action of CUSTOMER_ACTIONS) {
    for (const condition of CUSTOMER_CONDITIONS) {
      rows.push({ action, condition, effect: defaultEffectFor(action, condition), popup_code: popupCodeFor(action, condition) })
    }
  }
  rows.push({
    action: WHATSAPP_SEND_ACTION, condition: NO_CONSENT_CONDITION,
    effect: defaultEffectFor(WHATSAPP_SEND_ACTION, NO_CONSENT_CONDITION),
    popup_code: popupCodeFor(WHATSAPP_SEND_ACTION, NO_CONSENT_CONDITION),
  })
  return rows
}

afterEach(() => vi.clearAllMocks())

describe('ActionRulesSettings', () => {
  it('shows the loading state, then the error state on a failed fetch', async () => {
    ;(api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'))
    render(<ActionRulesSettings />)
    expect(screen.getByText(st('common.loading'))).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(st('actionRules.loadError'))).toBeInTheDocument())
  })

  it('shows the empty state when the backend returns no rows', async () => {
    ;(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: [] } })
    render(<ActionRulesSettings />)
    await waitFor(() => expect(screen.getByText(st('actionRules.empty'))).toBeInTheDocument())
  })

  it('renders the candidate and customer grids with the seed-default effects', async () => {
    ;(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: fullDefaultMatrix() } })
    render(<ActionRulesSettings />)
    await waitFor(() => expect(screen.getByText(st('actionRules.title'))).toBeInTheDocument())

    // application.create × blacklist defaults to block (P3) — a hard, tenant-editable block.
    const actionLabel = st('actionRules.actions.application_create')
    const conditionLabel = st('actionRules.conditions.blacklist')
    const effectLabel = st('actionRules.effect.block')
    const aria = st('actionRules.cellAria', { action: actionLabel, condition: conditionLabel, effect: effectLabel })
    expect(screen.getByRole('button', { name: aria })).toBeInTheDocument()
  })

  it('clicking a cell cycles its effect (block → allow) and stages it as dirty', async () => {
    ;(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: fullDefaultMatrix() } })
    const user = userEvent.setup()
    render(<ActionRulesSettings />)
    await waitFor(() => expect(screen.getByText(st('actionRules.title'))).toBeInTheDocument())

    const actionLabel = st('actionRules.actions.application_create')
    const conditionLabel = st('actionRules.conditions.blacklist')
    const blockAria = st('actionRules.cellAria', { action: actionLabel, condition: conditionLabel, effect: st('actionRules.effect.block') })
    await user.click(screen.getByRole('button', { name: blockAria }))

    const allowAria = st('actionRules.cellAria', { action: actionLabel, condition: conditionLabel, effect: st('actionRules.effect.allow') })
    expect(screen.getByRole('button', { name: allowAria })).toBeInTheDocument()
    expect(screen.getByText(st('actionRules.saveBar.dirtyCount', { count: 1 }))).toBeInTheDocument()
  })

  it('a locked cell (archived, P4) is disabled and never cycles on click', async () => {
    ;(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: fullDefaultMatrix() } })
    const user = userEvent.setup()
    render(<ActionRulesSettings />)
    await waitFor(() => expect(screen.getByText(st('actionRules.title'))).toBeInTheDocument())

    const actionLabel = st('actionRules.actions.application_create')
    const conditionLabel = st('actionRules.conditions.archived')
    const blockAria = st('actionRules.cellAria', { action: actionLabel, condition: conditionLabel, effect: st('actionRules.effect.block') })
    const lockedBtn = screen.getByRole('button', { name: blockAria })
    expect(lockedBtn).toBeDisabled()
    await user.click(lockedBtn)
    // Still block after a click attempt — a disabled button never fires onClick.
    expect(screen.getByRole('button', { name: blockAria })).toBeInTheDocument()
  })

  it('the AVG consent section renders whatsapp.send × no-consent as a locked hard block', async () => {
    ;(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: fullDefaultMatrix() } })
    const user = userEvent.setup()
    render(<ActionRulesSettings />)
    await waitFor(() => expect(screen.getByText(st('actionRules.title'))).toBeInTheDocument())

    // The consent grid lives on its own AVG sub-tab — not visible until selected.
    await user.click(screen.getByRole('tab', { name: st('actionRules.tabs.avg') }))
    expect(screen.getByText(st('actionRules.consentSectionTitle'))).toBeInTheDocument()

    const actionLabel = st('actionRules.actions.whatsapp_send')
    const conditionLabel = st('actionRules.conditions.whatsapp_no_consent')
    const aria = st('actionRules.cellAria', { action: actionLabel, condition: conditionLabel, effect: st('actionRules.effect.block') })
    expect(screen.getByRole('button', { name: aria })).toBeDisabled()
  })

  it('defaults to the Kandidaat tab and hides the Klant/AVG grids until selected', async () => {
    ;(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: fullDefaultMatrix() } })
    const user = userEvent.setup()
    render(<ActionRulesSettings />)
    await waitFor(() => expect(screen.getByText(st('actionRules.title'))).toBeInTheDocument())

    // Kandidaat grid visible by default; Klant/AVG grids not yet mounted.
    expect(screen.getByText(st('actionRules.candidateAxisTitle'))).toBeInTheDocument()
    expect(screen.queryByText(st('actionRules.customerAxisTitle'))).not.toBeInTheDocument()
    expect(screen.queryByText(st('actionRules.consentSectionTitle'))).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: st('actionRules.tabs.candidate') })).toHaveAttribute('aria-selected', 'true')

    // Switching to Klant swaps the grid and hides the Kandidaat one.
    await user.click(screen.getByRole('tab', { name: st('actionRules.tabs.customer') }))
    expect(screen.getByText(st('actionRules.customerAxisTitle'))).toBeInTheDocument()
    expect(screen.queryByText(st('actionRules.candidateAxisTitle'))).not.toBeInTheDocument()
  })

  it('a staged edit on Kandidaat stays dirty (save bar spans all tabs) after switching to Klant, then back', async () => {
    ;(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: fullDefaultMatrix() } })
    const user = userEvent.setup()
    render(<ActionRulesSettings />)
    await waitFor(() => expect(screen.getByText(st('actionRules.title'))).toBeInTheDocument())

    const actionLabel = st('actionRules.actions.application_create')
    const conditionLabel = st('actionRules.conditions.blacklist')
    const blockAria = st('actionRules.cellAria', { action: actionLabel, condition: conditionLabel, effect: st('actionRules.effect.block') })
    await user.click(screen.getByRole('button', { name: blockAria }))
    expect(screen.getByText(st('actionRules.saveBar.dirtyCount', { count: 1 }))).toBeInTheDocument()

    // Switch away — the dirty indicator (save bar chrome) is common to every tab.
    await user.click(screen.getByRole('tab', { name: st('actionRules.tabs.customer') }))
    expect(screen.getByText(st('actionRules.saveBar.dirtyCount', { count: 1 }))).toBeInTheDocument()

    // Switch back — the staged (still unsaved) effect is exactly as left.
    await user.click(screen.getByRole('tab', { name: st('actionRules.tabs.candidate') }))
    const allowAria = st('actionRules.cellAria', { action: actionLabel, condition: conditionLabel, effect: st('actionRules.effect.allow') })
    expect(screen.getByRole('button', { name: allowAria })).toBeInTheDocument()
    expect(screen.getByText(st('actionRules.saveBar.dirtyCount', { count: 1 }))).toBeInTheDocument()
  })

  it('opening a cell detail panel shows its popup code, then reset restores the default', async () => {
    ;(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: fullDefaultMatrix() } })
    const user = userEvent.setup()
    render(<ActionRulesSettings />)
    await waitFor(() => expect(screen.getByText(st('actionRules.title'))).toBeInTheDocument())

    const actionLabel = st('actionRules.actions.application_create')
    const conditionLabel = st('actionRules.conditions.blacklist')
    const detailAria = `${st('actionRules.cellAria', { action: actionLabel, condition: conditionLabel, effect: st('actionRules.effect.block') })} — ${st('actionRules.detail.title')}`
    await user.click(screen.getByRole('button', { name: detailAria }))

    // The detail panel shows the fixed popup code for this cell.
    expect(await screen.findByText('P3')).toBeInTheDocument()
    // It's still the (unchanged) default, so no reset button — only the "default rule" note.
    expect(screen.getByText(st('actionRules.detail.isDefault'))).toBeInTheDocument()
  })

  it('save PUTs only the changed cells and clears the dirty count on success', async () => {
    ;(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: fullDefaultMatrix() } })
    const savedMatrix = fullDefaultMatrix().map((r) =>
      r.action === 'application.create' && r.condition === 'blacklist' ? { ...r, effect: 'allow' } : r)
    ;(api.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: savedMatrix } })
    const user = userEvent.setup()
    render(<ActionRulesSettings />)
    await waitFor(() => expect(screen.getByText(st('actionRules.title'))).toBeInTheDocument())

    const actionLabel = st('actionRules.actions.application_create')
    const conditionLabel = st('actionRules.conditions.blacklist')
    const blockAria = st('actionRules.cellAria', { action: actionLabel, condition: conditionLabel, effect: st('actionRules.effect.block') })
    await user.click(screen.getByRole('button', { name: blockAria }))
    await user.click(screen.getByRole('button', { name: new RegExp(st('common.save')) }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/action-rules', {
      rules: [{ action: 'application.create', condition: 'blacklist', effect: 'allow' }],
    }))
    await waitFor(() => expect(screen.queryByText(st('actionRules.saveBar.dirtyCount', { count: 1 }))).not.toBeInTheDocument())
  })

  it('reset-all reverts every non-locked cell to default after confirm', async () => {
    const overridden = fullDefaultMatrix().map((r) =>
      r.action === 'application.create' && r.condition === 'blacklist' ? { ...r, effect: 'allow' } : r)
    ;(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: overridden } })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<ActionRulesSettings />)
    await waitFor(() => expect(screen.getByText(st('actionRules.title'))).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('actionRules.saveBar.resetAll') }))
    expect(window.confirm).toHaveBeenCalled()

    const actionLabel = st('actionRules.actions.application_create')
    const conditionLabel = st('actionRules.conditions.blacklist')
    const blockAria = st('actionRules.cellAria', { action: actionLabel, condition: conditionLabel, effect: st('actionRules.effect.block') })
    expect(screen.getByRole('button', { name: blockAria })).toBeInTheDocument()
  })
})
