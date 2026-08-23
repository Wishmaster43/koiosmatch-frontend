/**
 * NotificationsSettings (§13: assert the REAL /settings request, never only that a
 * callback fired) — O-27 (commit 551c17e1): the e-mail channel is now a real, working
 * second toggle next to in-app, both keyed `notif_<context>_in_app` / `notif_<context>_email`
 * and posted through the same generic /settings store. Covers: both switches render and
 * load with their O-27 defaults (in-app ON, e-mail OFF), toggling e-mail writes the e-mail
 * key while leaving the in-app key untouched (and vice versa), and the NOTIF-PARITY-1
 * no-emitter-yet gate disables BOTH channels for vacatures/facturering.
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
    it('renders BOTH channel switches, in-app defaulting ON and e-mail defaulting OFF (O-27)', async () => {
      render(<NotificationsSettings context={context} />)
      await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))

      const inApp = await screen.findByRole('switch', { name: t('notifications.inApp.label') })
      const email = screen.getByRole('switch', { name: t('notifications.email.label') })
      expect(inApp).toHaveAttribute('aria-checked', 'true')
      expect(email).toHaveAttribute('aria-checked', 'false')
    })

    it(`POSTs both notif_${context}_in_app and notif_${context}_email on save, e-mail write leaves in-app untouched`, async () => {
      const user = userEvent.setup()
      render(<NotificationsSettings context={context} />)
      const email = await screen.findByRole('switch', { name: t('notifications.email.label') })

      // Only the e-mail switch is flipped — the in-app value must ride along at its
      // untouched (loaded/default) value, never silently reset by the e-mail change.
      await user.click(email)
      await user.click(screen.getByRole('button', { name: t('common.save') }))

      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
        [`notif_${context}_in_app`]: 'true',
        [`notif_${context}_email`]: 'true',
      }))
    })

    it(`toggling in-app off leaves the e-mail key at its untouched default`, async () => {
      const user = userEvent.setup()
      render(<NotificationsSettings context={context} />)
      const inApp = await screen.findByRole('switch', { name: t('notifications.inApp.label') })

      await user.click(inApp)
      await user.click(screen.getByRole('button', { name: t('common.save') }))

      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
        [`notif_${context}_in_app`]: 'false',
        [`notif_${context}_email`]: 'false',
      }))
    })

    it('renders both switches fully working (no "not yet active" marker)', async () => {
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
    it('renders BOTH switches disabled and shows the "not yet active" marker once on the block', async () => {
      render(<NotificationsSettings context={context} />)
      const inApp = await screen.findByRole('switch', { name: t('notifications.inApp.label') })
      const email = screen.getByRole('switch', { name: t('notifications.email.label') })

      expect(inApp).toBeDisabled()
      expect(email).toBeDisabled()
      // ONE block since "1 blok met 2 toggles" (Danny 13-08) — so one marker for both.
      expect(screen.getAllByText(t('notifications.inApp.notYetActive'))).toHaveLength(1)
    })

    it('never lets a click flip either toggle or produce a save (§3: no fake affordance)', async () => {
      const user = userEvent.setup()
      render(<NotificationsSettings context={context} />)
      const inApp = await screen.findByRole('switch', { name: t('notifications.inApp.label') })
      const email = screen.getByRole('switch', { name: t('notifications.email.label') })

      await user.click(inApp)
      await user.click(email)

      // Disabled buttons swallow clicks — the default state never flips on either channel.
      expect(inApp).toHaveAttribute('aria-checked', 'true')
      expect(email).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByRole('button', { name: t('common.save') })).toBeDisabled()
      expect(api.post).not.toHaveBeenCalled()
    })
  },
)
