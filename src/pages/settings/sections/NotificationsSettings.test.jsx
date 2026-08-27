/**
 * NotificationsSettings (§13: assert the REAL /settings request, never only that a
 * callback fired) — O-27 (commit 551c17e1) + NOTIF-POPUP-1: three real, working toggles
 * (in-app / e-mail / popup), keyed `notif_<context>_in_app` / `notif_<context>_email` /
 * `notif_<context>_popup` and posted through the same generic /settings store. Covers:
 * all three switches render and load with their contract defaults (in-app ON, e-mail
 * OFF, popup ON), toggling one channel leaves the other two untouched, and the
 * NOTIF-PARITY-1 no-emitter-yet gate disables ALL THREE channels for vacatures/facturering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import NotificationsSettings from './NotificationsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: {} })
  api.post.mockResolvedValue({ data: {} })
})

describe.each(['sollicitaties', 'kandidaten', 'klanten', 'matches', 'taken', 'calllists', 'opportunities'])(
  'NotificationsSettings — context=%s',
  context => {
    it('renders ALL THREE channel switches, in-app/popup defaulting ON and e-mail defaulting OFF (O-27, NOTIF-POPUP-1)', async () => {
      render(<NotificationsSettings context={context} />)
      await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))

      const inApp = await screen.findByRole('switch', { name: t('notifications.inApp.label') })
      const email = screen.getByRole('switch', { name: t('notifications.email.label') })
      const popup = screen.getByRole('switch', { name: t('notifications.popup.label') })
      expect(inApp).toHaveAttribute('aria-checked', 'true')
      expect(email).toHaveAttribute('aria-checked', 'false')
      expect(popup).toHaveAttribute('aria-checked', 'true')
    })

    it(`POSTs notif_${context}_in_app, notif_${context}_email and notif_${context}_popup on save, e-mail write leaves the others untouched`, async () => {
      const user = userEvent.setup()
      render(<NotificationsSettings context={context} />)
      const email = await screen.findByRole('switch', { name: t('notifications.email.label') })

      // Only the e-mail switch is flipped — in-app and popup must ride along at their
      // untouched (loaded/default) value, never silently reset by the e-mail change.
      await user.click(email)
      await user.click(screen.getByRole('button', { name: t('common.save') }))

      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
        [`notif_${context}_in_app`]: 'true',
        [`notif_${context}_email`]: 'true',
        [`notif_${context}_popup`]: 'true',
      }))
    })

    it(`toggling in-app off leaves the e-mail and popup keys at their untouched default`, async () => {
      const user = userEvent.setup()
      render(<NotificationsSettings context={context} />)
      const inApp = await screen.findByRole('switch', { name: t('notifications.inApp.label') })

      await user.click(inApp)
      await user.click(screen.getByRole('button', { name: t('common.save') }))

      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
        [`notif_${context}_in_app`]: 'false',
        [`notif_${context}_email`]: 'false',
        [`notif_${context}_popup`]: 'true',
      }))
    })

    it(`toggling popup off leaves in-app and e-mail at their untouched default`, async () => {
      const user = userEvent.setup()
      render(<NotificationsSettings context={context} />)
      const popup = await screen.findByRole('switch', { name: t('notifications.popup.label') })

      await user.click(popup)
      await user.click(screen.getByRole('button', { name: t('common.save') }))

      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
        [`notif_${context}_in_app`]: 'true',
        [`notif_${context}_email`]: 'false',
        [`notif_${context}_popup`]: 'false',
      }))
    })

    it('renders all three switches fully working (no "not yet active" marker)', async () => {
      render(<NotificationsSettings context={context} />)
      await screen.findByRole('switch', { name: t('notifications.inApp.label') })
      expect(screen.queryByText(t('notifications.inApp.notYetActive'))).not.toBeInTheDocument()
    })

    it('shows a real translated title, never the raw context id (missing locale key regression)', async () => {
      render(<NotificationsSettings context={context} />)
      const heading = await screen.findByRole('heading', { name: t(`notifications.context.${context}.title`, context) })
      expect(heading).toHaveTextContent(t(`notifications.context.${context}.title`))
      expect(heading.textContent).not.toBe(context)
    })
  },
)

describe.each(['vacatures', 'facturering'])(
  'NotificationsSettings — context=%s has no backend emitter yet (NOTIF-PARITY-1)',
  context => {
    it('renders ALL THREE switches disabled and shows the "not yet active" marker once on the block', async () => {
      render(<NotificationsSettings context={context} />)
      const inApp = await screen.findByRole('switch', { name: t('notifications.inApp.label') })
      const email = screen.getByRole('switch', { name: t('notifications.email.label') })
      const popup = screen.getByRole('switch', { name: t('notifications.popup.label') })

      expect(inApp).toBeDisabled()
      expect(email).toBeDisabled()
      expect(popup).toBeDisabled()
      // ONE block since "1 blok met 2 toggles" (Danny 13-08) — so one marker for all three.
      expect(screen.getAllByText(t('notifications.inApp.notYetActive'))).toHaveLength(1)
    })

    it('never lets a click flip any toggle or produce a save (§3: no fake affordance)', async () => {
      const user = userEvent.setup()
      render(<NotificationsSettings context={context} />)
      const inApp = await screen.findByRole('switch', { name: t('notifications.inApp.label') })
      const email = screen.getByRole('switch', { name: t('notifications.email.label') })
      const popup = screen.getByRole('switch', { name: t('notifications.popup.label') })

      await user.click(inApp)
      await user.click(email)
      await user.click(popup)

      // Disabled buttons swallow clicks — the default state never flips on any channel.
      expect(inApp).toHaveAttribute('aria-checked', 'true')
      expect(email).toHaveAttribute('aria-checked', 'false')
      expect(popup).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByRole('button', { name: t('common.save') })).toBeDisabled()
      expect(api.post).not.toHaveBeenCalled()
    })
  },
)
