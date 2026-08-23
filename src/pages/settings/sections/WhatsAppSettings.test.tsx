/**
 * WhatsAppSettings.test — F2 seam coverage (WA-WABA-POLISH-1): a real WABA switch
 * on the Connection tab (WhatsAppConnectionForm, PATCH /whatsapp/{id}) deactivates
 * every linked phone number server-side. This pins that the Numbers tab actually
 * reflects that afterwards — the detail refetch fires through the EXISTING reload
 * path (the connections list's own `reload()`, already invoked by the form's
 * `onSaved`), never a second endpoint — and that a deactivated row renders an
 * honest inactive chip, not silence.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import WhatsAppSettings from './WhatsAppSettings'

// Partial mock: fake the HTTP verbs, keep the real unwrap/unwrapList helpers.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { ...actual.default, get: vi.fn(), post: vi.fn(), patch: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn(), notifySuccess: vi.fn() }))
// whatsapp.manage granted — the mutation affordances (edit) must render.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [] }))
// The users barrel is a public-surface module (§2) — mocked FLAT, mirrors
// WhatsAppConnectionForm.test.tsx's own convention.
vi.mock('@/pages/users/shared', () => ({
  useAssignableRoles: () => ({ roles: [], loading: false }),
  roleLabel: (_t: unknown, name: string) => name,
}))

// Resolve the active locale's own copy so assertions never hardcode a language
// (mirrors WhatsAppConnectionsList.test.tsx's own `st` helper).
const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const CONN = {
  id: 'conn-1', waba_id: '10229012934', label: null, location_id: null, role_name: null,
  is_default: true, has_verify_token: false, provider: 'meta' as const, status: 'active' as const,
}

describe('WhatsAppSettings · Numbers tab reflects a WABA switch (F2)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('a WABA switch deactivates a number server-side, and the Numbers tab shows it as inactive after the save reload', async () => {
    // The one phone number starts ACTIVE; the PATCH mock flips it, simulating the
    // server-side deactivation — the test then proves the FE actually re-fetches
    // and re-renders it, rather than assuming the toast alone is enough.
    let numberActive = true
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/whatsapp') return Promise.resolve({ data: { data: [CONN] } })
      if (url === '/whatsapp/conn-1') {
        return Promise.resolve({ data: { data: {
          phone_numbers: [{ id: 'p1', name: 'Yesway hoofdlijn', display_number: '+31612345678', active: numberActive }],
          templates: [],
        } } })
      }
      return Promise.resolve({ data: { data: [] } })
    })
    vi.mocked(api.patch).mockImplementation(async () => {
      // Mirrors WhatsappController::update: a real switch deactivates the numbers.
      numberActive = false
      return { data: { data: { ...CONN, waba_id: '999888777', phone_numbers_deactivated: 1 } } }
    })
    vi.mocked(api.post).mockResolvedValue({ data: {} })

    const user = userEvent.setup()
    render(<WhatsAppSettings />)

    // Wait for the connection list to load, then open the edit form.
    await screen.findByText('10229012934')
    await user.click(screen.getByRole('button', { name: st('common.edit') }))

    // Regex, not exact text: the required-field label carries a trailing "*" marker.
    const wabaField = screen.getByLabelText(new RegExp(st('whatsapp.wabaId')))
    await user.clear(wabaField)
    await user.type(wabaField, '999888777')
    await user.click(screen.getByRole('button', { name: st('common.save') }))
    await screen.findByText(st('whatsapp.wabaSwitchConfirmMessage'))
    await user.click(screen.getByRole('button', { name: st('whatsapp.wabaSwitchConfirmButton') }))

    // The save reloads the connections list (existing path) — the numbers/templates
    // detail effect depends on that same `connections` state, so it refetches too.
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.filter(c => c[0] === '/whatsapp/conn-1').length).toBeGreaterThanOrEqual(2))

    // Switch to the Numbers tab and confirm the row now reads as inactive.
    await user.click(screen.getByRole('tab', { name: new RegExp(st('whatsapp.phoneNumbers')) }))
    expect(await screen.findByText(st('whatsapp.numberInactive'))).toBeInTheDocument()
  })

  it('an ACTIVE number never shows the inactive chip', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/whatsapp') return Promise.resolve({ data: { data: [CONN] } })
      if (url === '/whatsapp/conn-1') {
        return Promise.resolve({ data: { data: {
          phone_numbers: [{ id: 'p1', name: 'Yesway hoofdlijn', display_number: '+31612345678', active: true }],
          templates: [],
        } } })
      }
      return Promise.resolve({ data: { data: [] } })
    })

    const user = userEvent.setup()
    render(<WhatsAppSettings />)
    await screen.findByText('10229012934')

    await user.click(screen.getByRole('tab', { name: new RegExp(st('whatsapp.phoneNumbers')) }))
    await screen.findByText('+31612345678')
    expect(screen.queryByText(st('whatsapp.numberInactive'))).not.toBeInTheDocument()
  })
})
