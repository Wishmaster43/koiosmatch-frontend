/**
 * NotificationsSettings (§13: assert the REAL /settings request, never only that a
 * callback fired) — covers the honest-gate rewrite (06-08): the email row is HIDDEN
 * unconditionally (no backend mail-capability signal exists), and the in-app toggle
 * loads/saves `notif_<context>_in_app` for whichever context is passed in, including
 * the new NOTIF-KANDIDAAT-1 contexts (kandidaten / matches / taken).
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

describe('NotificationsSettings — email column stays hidden', () => {
  it('never renders an email row for any context (no mail-capability signal)', async () => {
    render(<NotificationsSettings context="sollicitaties" />)
    await screen.findByText(t('notifications.inApp.label'))
    expect(screen.queryByText(t('notifications.email.label'))).not.toBeInTheDocument()
  })
})

describe.each(['sollicitaties', 'kandidaten', 'matches', 'taken'])(
  'NotificationsSettings — context=%s',
  context => {
    it(`GETs /settings and defaults notif_${context}_in_app to ON`, async () => {
      render(<NotificationsSettings context={context} />)
      await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
      const toggle = await screen.findByRole('switch')
      expect(toggle).toHaveAttribute('aria-checked', 'true')
    })

    it(`POSTs notif_${context}_in_app=false to /settings on save`, async () => {
      const user = userEvent.setup()
      render(<NotificationsSettings context={context} />)
      const toggle = await screen.findByRole('switch')

      await user.click(toggle)
      await user.click(screen.getByRole('button', { name: t('common.save') }))

      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
        [`notif_${context}_in_app`]: 'false',
      }))
    })
  },
)
