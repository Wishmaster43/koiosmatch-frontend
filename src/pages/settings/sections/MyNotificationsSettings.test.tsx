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
  vi.mocked(api.get).mockResolvedValue({ data: { contexts: {} } })
})

describe('MyNotificationsSettings', () => {
  it('GETs /settings/my-notifications on mount and renders one row per returned context', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: null, matches: false } } })
    render(<MyNotificationsSettings />)

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings/my-notifications'))
    expect(await screen.findByText(t('notifications.context.sollicitaties.title'))).toBeInTheDocument()
    expect(screen.getByText(t('notifications.context.matches.title'))).toBeInTheDocument()
  })

  it('renders an honest "not available yet" e-mail marker next to in-app, not a second control (O-27)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: null, matches: false } } })
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.sollicitaties.title'))

    // Exactly one radiogroup (in-app) per row — the e-mail column is a muted marker,
    // never a second working control (§3 no fake affordance: MyNotificationSettingsController
    // has no channel param to target the per-user e-mail override with).
    expect(screen.getAllByRole('radiogroup')).toHaveLength(2)
    expect(screen.getAllByText(t('notifications.my.emailNotAvailable'))).toHaveLength(2)
  })

  it('reflects the loaded tri-state per row: inherit for null, off for false', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: null, matches: false } } })
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.sollicitaties.title'))

    const rows = screen.getAllByRole('radiogroup')
    expect(within(rows[0]).getByRole('radio', { name: t('notifications.my.inherit') })).toHaveAttribute('aria-checked', 'true')
    expect(within(rows[1]).getByRole('radio', { name: t('notifications.my.off') })).toHaveAttribute('aria-checked', 'true')
  })

  it('PUTs { contexts: { sollicitaties: false } } when switching a row to Off', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: null } } })
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.sollicitaties.title'))

    await user.click(screen.getByRole('radio', { name: t('notifications.my.off') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/my-notifications', {
      contexts: { sollicitaties: false },
    }))
  })

  it('PUTs { contexts: { sollicitaties: null } } when switching a row back to Inherit', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: true } } })
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.sollicitaties.title'))

    await user.click(screen.getByRole('radio', { name: t('notifications.my.inherit') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/my-notifications', {
      contexts: { sollicitaties: null },
    }))
  })

  it('NOTIF-PARITY-1: a no-emitter context (vacatures/facturering) shows a muted marker instead of a working in-app override, and never PUTs', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { vacatures: null, facturering: null } } })
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.vacatures.title'))

    // No SegmentedControl (radiogroup) for either no-emitter context — both columns
    // render the same honest "not active yet" marker (§3 no fake affordance).
    expect(screen.queryAllByRole('radiogroup')).toHaveLength(0)
    expect(screen.getAllByText(t('notifications.inApp.notYetActive'))).toHaveLength(2)
    expect(screen.getAllByText(t('notifications.my.emailNotAvailable'))).toHaveLength(2)
    expect(api.put).not.toHaveBeenCalled()
  })

  it('rolls back the row and toasts on a failed PUT', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: { sollicitaties: null } } })
    vi.mocked(api.put).mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    render(<MyNotificationsSettings />)
    await screen.findByText(t('notifications.context.sollicitaties.title'))

    await user.click(screen.getByRole('radio', { name: t('notifications.my.off') }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(t('notifications.my.saveFailed')))
    expect(screen.getByRole('radio', { name: t('notifications.my.inherit') })).toHaveAttribute('aria-checked', 'true')
  })

  it('shows a load error notice when the GET fails', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network'))
    render(<MyNotificationsSettings />)
    expect(await screen.findByText(t('common.loadError'))).toBeInTheDocument()
  })

  it('shows an empty state when the API returns no known contexts', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { contexts: {} } })
    render(<MyNotificationsSettings />)
    expect(await screen.findByText(t('notifications.my.empty'))).toBeInTheDocument()
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
