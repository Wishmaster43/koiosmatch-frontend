/**
 * MyNotificationsSettings — G28: proves the REAL request shape per §13 (route +
 * body), not just that a handler fired. Covers the GET load (rows derived from
 * whatever contexts the API returns, never a hardcoded list), the tri-state PUT
 * (inherit/on/off → null/true/false) fired per row, and the optimistic rollback
 * + toast on a failed save. Also covers the four explicit UI states.
 *
 * O-27 (commit 551c17e1): the e-mail column next to in-app is an HONEST GATE, not
 * a working control — `MyNotificationSettingsController` has no channel param, so
 * a click there must never fire a PUT (§3 no fake affordance). Covered below.
 *
 * P11-FASE5: the "browser notifications" row on top wraps `lib/pushSubscription`,
 * mocked here so these tests drive the toggle wiring (on -> subscribe, off ->
 * unsubscribe, unsupported -> disabled) — the request-shape assertions for the
 * lib itself live in `lib/pushSubscription.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import * as pushSubscription from '@/lib/pushSubscription'
import MyNotificationsSettings from './MyNotificationsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@/lib/pushSubscription', () => ({
  isSupported: vi.fn(() => true),
  permissionState: vi.fn(() => 'default'),
  isSubscribed: vi.fn().mockResolvedValue(false),
  subscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
}))

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(pushSubscription.isSupported).mockReturnValue(true)
  vi.mocked(pushSubscription.permissionState).mockReturnValue('default')
  vi.mocked(pushSubscription.isSubscribed).mockResolvedValue(false)
  vi.mocked(pushSubscription.subscribe).mockResolvedValue(undefined)
  vi.mocked(pushSubscription.unsubscribe).mockResolvedValue(undefined)
  vi.mocked(api.get).mockResolvedValue({ data: { contexts: {}, popup: {} } })
})

describe('MyNotificationsSettings', () => {
  it('GETs /settings/my-notifications on mount and renders one row per returned context', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: null, matches: false } } })
    render(<MyNotificationsSettings />)

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings/my-notifications'))
    expect(await screen.findByText(t('notifications.context.sollicitaties.title'))).toBeInTheDocument()
    expect(screen.getByText(t('notifications.context.matches.title'))).toBeInTheDocument()
  })

  it('renders an honest "not available yet" e-mail marker next to in-app/popup, not a second control (O-27)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: null, matches: false }, popup: {} } })
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.sollicitaties.title'))

    // Two radiogroups per row (in-app + popup) — the e-mail column is a muted marker,
    // never a working control (§3 no fake affordance: MyNotificationSettingsController
    // has no channel param to target the per-user e-mail override with).
    expect(screen.getAllByRole('radiogroup')).toHaveLength(4)
    expect(screen.getAllByText(t('notifications.my.emailNotAvailable'))).toHaveLength(2)
  })

  it('reflects the loaded tri-state per row: inherit for null, off for false, on both in-app and popup', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { contexts: { sollicitaties: null, matches: false }, popup: { sollicitaties: true, matches: null } },
    })
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.sollicitaties.title'))

    const rows = screen.getAllByRole('radiogroup')
    // Row order per context: in-app first, popup second.
    expect(within(rows[0]).getByRole('radio', { name: t('notifications.my.inherit') })).toHaveAttribute('aria-checked', 'true')
    expect(within(rows[1]).getByRole('radio', { name: t('notifications.my.on') })).toHaveAttribute('aria-checked', 'true')
    expect(within(rows[2]).getByRole('radio', { name: t('notifications.my.off') })).toHaveAttribute('aria-checked', 'true')
    expect(within(rows[3]).getByRole('radio', { name: t('notifications.my.inherit') })).toHaveAttribute('aria-checked', 'true')
  })

  it('PUTs { contexts: { sollicitaties: false } } when switching the in-app row to Off', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: null }, popup: {} } })
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.sollicitaties.title'))

    await user.click(screen.getAllByRole('radio', { name: t('notifications.my.off') })[0])

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/my-notifications', {
      contexts: { sollicitaties: false },
    }))
  })

  it('PUTs { contexts: { sollicitaties: null } } when switching the in-app row back to Inherit', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: true }, popup: {} } })
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.sollicitaties.title'))

    await user.click(screen.getAllByRole('radio', { name: t('notifications.my.inherit') })[0])

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/my-notifications', {
      contexts: { sollicitaties: null },
    }))
  })

  it('PUTs { popup: { sollicitaties: false } } when switching the popup row to Off (NOTIF-POPUP-1)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: null }, popup: { sollicitaties: null } } })
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.sollicitaties.title'))

    // Second radiogroup in the row is the popup column.
    await user.click(within(screen.getAllByRole('radiogroup')[1]).getByRole('radio', { name: t('notifications.my.off') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/my-notifications', {
      popup: { sollicitaties: false },
    }))
    // The popup PUT never touches the in-app `contexts` map.
    expect(api.put).not.toHaveBeenCalledWith('/settings/my-notifications', { contexts: expect.anything() })
  })

  it('NOTIF-PARITY-1: a no-emitter context (vacatures/facturering) shows a muted marker instead of working in-app/popup overrides, and never PUTs', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { vacatures: null, facturering: null }, popup: {} } })
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.vacatures.title'))

    // No SegmentedControl (radiogroup) for either no-emitter context — every column
    // renders the same honest "not active yet" marker (§3 no fake affordance).
    expect(screen.queryAllByRole('radiogroup')).toHaveLength(0)
    expect(screen.getAllByText(t('notifications.inApp.notYetActive'))).toHaveLength(4)
    expect(screen.getAllByText(t('notifications.my.emailNotAvailable'))).toHaveLength(2)
    expect(api.put).not.toHaveBeenCalled()
  })

  it('rolls back the in-app row and toasts on a failed PUT', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: null }, popup: {} } })
    vi.mocked(api.put).mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.sollicitaties.title'))

    await user.click(screen.getAllByRole('radio', { name: t('notifications.my.off') })[0])

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(t('notifications.my.saveFailed')))
    expect(screen.getAllByRole('radio', { name: t('notifications.my.inherit') })[0]).toHaveAttribute('aria-checked', 'true')
  })

  it('rolls back the popup row and toasts on a failed PUT (NOTIF-POPUP-1)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: null }, popup: { sollicitaties: null } } })
    vi.mocked(api.put).mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.sollicitaties.title'))

    await user.click(within(screen.getAllByRole('radiogroup')[1]).getByRole('radio', { name: t('notifications.my.off') }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(t('notifications.my.saveFailed')))
    expect(within(screen.getAllByRole('radiogroup')[1]).getByRole('radio', { name: t('notifications.my.inherit') })).toHaveAttribute('aria-checked', 'true')
  })

  it('shows a load error notice when the GET fails', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network'))
    render(<MyNotificationsSettings />)
    expect(await screen.findByText(t('common.loadError'))).toBeInTheDocument()
  })

  it('shows an empty state when the API returns no known contexts', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: {}, popup: {} } })
    render(<MyNotificationsSettings />)
    expect(await screen.findByText(t('notifications.my.empty'))).toBeInTheDocument()
  })

  // SUPERSEDE (Opus render probe, 28-08): the per-row hint measured as landing
  // INSIDE the flex controls row, repeating identically per context and flashing
  // on load for subscribed users — the browser-push row at the top of the screen
  // already carries the subscribe state ONCE. The rows stay hint-free.
  it('renders NO per-row push hint — the top push row carries that state once', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: null, matches: null }, popup: { sollicitaties: null } } })
    vi.mocked(pushSubscription.isSubscribed).mockResolvedValue(false)
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.sollicitaties.title'))

    expect(screen.queryByText(t('notifications.popup.needsSubscription'))).not.toBeInTheDocument()
  })

  it('renders no per-row push hint when subscribed either (NOTIF-POPUP-1)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: null }, popup: { sollicitaties: null } } })
    vi.mocked(pushSubscription.isSubscribed).mockResolvedValue(true)
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.sollicitaties.title'))

    expect(screen.queryByText(t('notifications.popup.needsSubscription'))).not.toBeInTheDocument()
  })

  describe('browser-push toggle (P11-FASE5)', () => {
    it('turning it on calls pushSubscription.subscribe()', async () => {
      const user = userEvent.setup()
      render(<MyNotificationsSettings />)
      const toggle = await screen.findByRole('switch', { name: t('notifications.push.title') })

      await user.click(toggle)

      await waitFor(() => expect(pushSubscription.subscribe).toHaveBeenCalled())
      expect(pushSubscription.unsubscribe).not.toHaveBeenCalled()
    })

    it('turning it off calls pushSubscription.unsubscribe()', async () => {
      vi.mocked(pushSubscription.isSubscribed).mockResolvedValue(true)
      const user = userEvent.setup()
      render(<MyNotificationsSettings />)
      const toggle = await screen.findByRole('switch', { name: t('notifications.push.title') })
      await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))

      await user.click(toggle)

      await waitFor(() => expect(pushSubscription.unsubscribe).toHaveBeenCalled())
      expect(pushSubscription.subscribe).not.toHaveBeenCalled()
    })

    it('rolls back and toasts when subscribe() fails', async () => {
      vi.mocked(pushSubscription.subscribe).mockRejectedValue(new Error('denied'))
      const user = userEvent.setup()
      render(<MyNotificationsSettings />)
      const toggle = await screen.findByRole('switch', { name: t('notifications.push.title') })

      await user.click(toggle)

      await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
      expect(notifyError).toHaveBeenCalledWith(t('notifications.push.subscribeFailed'))
    })

    it('renders disabled with an honest notice when unsupported (§3, no fake affordance)', async () => {
      vi.mocked(pushSubscription.isSupported).mockReturnValue(false)
      render(<MyNotificationsSettings />)

      const toggle = await screen.findByRole('switch', { name: t('notifications.push.title') })
      expect(toggle).toBeDisabled()
      expect(screen.getByText(t('notifications.push.unsupported'))).toBeInTheDocument()
    })

    it('renders disabled with a "blocked" hint when permission is denied', async () => {
      vi.mocked(pushSubscription.permissionState).mockReturnValue('denied')
      render(<MyNotificationsSettings />)

      const toggle = await screen.findByRole('switch', { name: t('notifications.push.title') })
      expect(toggle).toBeDisabled()
      expect(screen.getByText(t('notifications.push.blocked'))).toBeInTheDocument()
    })
  })
})


// NOTIF-POPUP-FE-1, Opus-vondst: an ABSENT popup key is INHERIT (tenant default
// ON) — the first version displayed 'Uit' for the common real-world response.
describe('MyNotificationsSettings — popup absent-key tolerance', () => {
  it('shows inherit for a context the popup map omits', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: null }, popup: {} } })
    render(<MyNotificationsSettings />)
    const groups = await screen.findAllByRole('radiogroup')
    const popupGroup = groups.find(g => (g.getAttribute('aria-label') ?? '').includes(t('notifications.popup.label')))
    expect(popupGroup).toBeDefined()
    expect(within(popupGroup!).getByRole('radio', { name: t('notifications.my.inherit') }))
      .toHaveAttribute('aria-checked', 'true')
  })
})
