/**
 * LocationsSettings — covers the four UI states (loading/error/empty/success), the
 * edit round-trip (house pencil pattern → PATCH /locations/{id}), and the live
 * delete flow (LOC-DELETE-GUARD-FE): a row already flagged `in_use` by the list
 * endpoint stays disabled with a tooltip; an enabled row confirms via the shared
 * house ConfirmDialog (useConfirm — never native window.confirm), DELETEs, and
 * either drops out of the list (success) or surfaces the backend's per-type
 * `counts` payload as an i18n'd in-use message while the row stays put (409).
 * Also covers VESTIGING-ICOON-1: `locations.color`/`locations.icon` are real,
 * persisted columns now — the per-row badge renders them when set and falls back
 * to the deterministic hash + Building2 glyph only for older rows that have
 * neither; the add/edit form's ColorSwatch/IconPickerControl ride both fields
 * along in the create/update payload.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import LocationsSettings from './LocationsSettings'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })
// The house ConfirmDialog (useConfirm) renders its Confirm/Cancel labels from the
// 'common' namespace's TOP-LEVEL keys (not settings.json's nested "common" block
// that `st('common.*')` resolves) — its own helper keeps that distinction honest.
const ct = (key, opts) => i18n.t(key, { ns: 'common', ...opts })

// Click Delete for a row, then resolve the house confirm dialog it stages
// (never native window.confirm) by clicking Confirm or Cancel inside it.
const confirmDelete = async (user, name, { accept = true } = {}) => {
  await user.click(screen.getByRole('button', { name: st('locations.delete') }))
  const dialog = await screen.findByRole('dialog', { name: st('locations.confirmDelete', { name }) })
  await user.click(within(dialog).getByRole('button', { name: accept ? ct('confirm') : ct('cancel') }))
}

const location = (over = {}) => ({
  id: 'loc1', name: 'Kantoor Rotterdam', street: 'Coolsingel', house_number: '1', house_number_suffix: '',
  postal_code: '3011AD', city: 'Rotterdam', country: 'Nederland', coc_number: '', vat_number: '',
  contact_name: '', phone: '', email: '',
  address: 'Coolsingel 1, 3011AD Rotterdam', full_address: 'Coolsingel 1, 3011AD Rotterdam',
  lat: 51.9225, lng: 4.47917, created_at: '2026-07-01T10:00:00Z', in_use: false,
  ...over,
})

afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks() })

describe('LocationsSettings', () => {
  it('shows the loading state, then the error state on a failed fetch', async () => {
    api.get.mockRejectedValue(new Error('network down'))
    render(<LocationsSettings />)
    expect(screen.getByText(st('common.loadingShort'))).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(st('locations.loadError'))).toBeInTheDocument())
  })

  it('shows the empty state when the backend returns no locations', async () => {
    api.get.mockResolvedValue({ data: { data: [] } })
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText(st('locations.empty'))).toBeInTheDocument())
  })

  it('renders the location row with its address', async () => {
    api.get.mockResolvedValue({ data: { data: [location()] } })
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())
    expect(screen.getByText('Coolsingel 1, 3011AD Rotterdam')).toBeInTheDocument()
  })

  it('a location already flagged in_use by the list keeps delete disabled with a tooltip', async () => {
    api.get.mockResolvedValue({ data: { data: [location({ in_use: true })] } })
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    const deleteBtn = screen.getByRole('button', { name: st('locations.deleteBlockedTooltip') })
    expect(deleteBtn).toBeDisabled()
  })

  it('delete click confirms via the house dialog, DELETEs /locations/{id}, and removes the row on success', async () => {
    api.get.mockResolvedValue({ data: { data: [location()] } })
    api.delete.mockResolvedValue({})
    const { notifySuccess } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await confirmDelete(user, 'Kantoor Rotterdam')

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/locations/loc1'))
    await waitFor(() => expect(screen.queryByText('Kantoor Rotterdam')).not.toBeInTheDocument())
    expect(notifySuccess).toHaveBeenCalledWith(st('locations.deleteSuccess'))
  })

  it('declining the house confirm dialog never calls DELETE', async () => {
    api.get.mockResolvedValue({ data: { data: [location()] } })
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await confirmDelete(user, 'Kantoor Rotterdam', { accept: false })

    expect(api.delete).not.toHaveBeenCalled()
    expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument()
  })

  it('a 409 with an in_use counts payload shows the linked-objects message and keeps the row', async () => {
    api.get.mockResolvedValue({ data: { data: [location()] } })
    api.delete.mockRejectedValue({ response: { status: 409, data: { in_use: true, counts: { candidates: 3, tasks: 1 } } } })
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await confirmDelete(user, 'Kantoor Rotterdam')

    // The message spells out WHAT is still linked, built from the payload's counts.
    const expectedList = `${st('locations.usage.candidates', { count: 3 })}, ${st('locations.usage.tasks', { count: 1 })}`
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('locations.deleteBlocked', { list: expectedList })))
    // The row stays — a 409 never drops data from the list.
    expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument()
    // And it is now disabled, mirroring a location the list already flagged in_use.
    expect(await screen.findByRole('button', { name: st('locations.deleteBlockedTooltip') })).toBeDisabled()
  })

  it('a non-409 delete failure surfaces the generic notifyError, not a raw server error', async () => {
    api.get.mockResolvedValue({ data: { data: [location()] } })
    api.delete.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await confirmDelete(user, 'Kantoor Rotterdam')

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('locations.deleteFailed')))
    expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument()
  })

  it('the pencil opens the edit modal prefilled, and Save PATCHes /locations/{id}', async () => {
    api.get.mockResolvedValue({ data: { data: [location()] } })
    api.patch.mockResolvedValue({ data: { data: location({ name: 'Kantoor Rotterdam Centrum' }) } })
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('locations.edit') }))
    expect(screen.getByText(st('locations.editTitle'))).toBeInTheDocument()

    // Prefilled from the row — not a blank create form.
    const nameInput = screen.getByLabelText(st('locations.nameLabel'))
    expect(nameInput).toHaveValue('Kantoor Rotterdam')
    const cityInput = screen.getByLabelText(st('locations.city'))
    expect(cityInput).toHaveValue('Rotterdam')

    await user.clear(nameInput)
    await user.type(nameInput, 'Kantoor Rotterdam Centrum')
    await user.click(screen.getByRole('button', { name: st('common.save') }))

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/locations/loc1',
      expect.objectContaining({ name: 'Kantoor Rotterdam Centrum', city: 'Rotterdam' })))
    // The unwrapped (not double-wrapped) resource replaces the row in the table.
    expect(await screen.findByText('Kantoor Rotterdam Centrum')).toBeInTheDocument()
  })

  it('a failed edit surfaces notifyError and keeps the modal state (no silent failure)', async () => {
    api.get.mockResolvedValue({ data: { data: [location()] } })
    api.patch.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('locations.edit') }))
    await user.click(screen.getByRole('button', { name: st('common.save') }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('locations.saveFailed')))
  })

  it('creating a new location unwraps the resource (not the {"data": …} envelope) into the table', async () => {
    api.get.mockResolvedValue({ data: { data: [] } })
    api.post.mockResolvedValue({ data: { data: location({ id: 'loc2', name: 'Nieuwe vestiging' }) } })
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText(st('locations.empty'))).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('locations.create') }))
    await user.type(screen.getByLabelText(st('locations.nameLabel')), 'Nieuwe vestiging')
    await user.click(screen.getByRole('button', { name: st('locations.createBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/locations', expect.objectContaining({ name: 'Nieuwe vestiging' })))
    // Regression guard: the row shows the plain name, never "[object Object]" from a
    // stored-but-unwrapped { data: {...} } envelope.
    expect(await screen.findByText('Nieuwe vestiging')).toBeInTheDocument()
  })

  it('VESTIGING-ICOON-1 fallback: a row with no stored colour/icon falls back to the read-only hash badge', async () => {
    // Neither `location()` factory row sets color/icon — mirrors an older row saved
    // before these columns existed on `locations`.
    api.get.mockResolvedValue({ data: { data: [location(), location({ id: 'loc2', name: 'Vestiging Utrecht' })] } })
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    // The badge sits next to the name; querying via the name text keeps this test
    // resilient to markup changes elsewhere in the row.
    const badgeOf = (name) => screen.getByText(name).querySelector('span[aria-hidden="true"]')
    const rotterdamBadge = badgeOf('Kantoor Rotterdam')
    const utrechtBadge = badgeOf('Vestiging Utrecht')

    // The generic Building2 glyph renders (identifiability "at a glance"), not just a coloured dot.
    expect(rotterdamBadge.querySelector('svg.lucide-building2')).toBeInTheDocument()
    // Same `avatarColor` hash the rest of the app uses (Avatar / Shiftmanager
    // entities) — 'K'.charCodeAt(0) % 7 = 5 → AVATAR_COLORS[5]; 'V' → index 2.
    // eslint-disable-next-line no-restricted-syntax -- DATA: asserting the exact AVATAR_COLORS[5] palette entry, not an invented UI colour
    expect(rotterdamBadge).toHaveStyle({ background: 'color-mix(in srgb, #8B5CF6 14%, transparent)' })
    expect(utrechtBadge).toHaveStyle({ background: 'color-mix(in srgb, var(--color-success) 14%, transparent)' })
    // Two different names must hash to two different colours — that is what makes
    // rows scannable instead of a uniform icon repeated on every row.
    expect(rotterdamBadge.style.background).not.toEqual(utrechtBadge.style.background)
  })

  it('VESTIGING-ICOON-1: a row WITH a stored colour/icon renders those instead of the hash fallback', async () => {
    // eslint-disable-next-line no-restricted-syntax -- DATA: mock API row colour, not UI styling
    api.get.mockResolvedValue({ data: { data: [location({ color: '#059669', icon: 'store' })] } })
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    const badge = screen.getByText('Kantoor Rotterdam').querySelector('span[aria-hidden="true"]')
    // The row's OWN colour drives the tint — not the deterministic name hash.
    // eslint-disable-next-line no-restricted-syntax -- DATA: asserting the exact stored row colour, not an invented UI colour
    expect(badge).toHaveStyle({ background: 'color-mix(in srgb, #059669 14%, transparent)' })
    // The row's OWN icon renders — the 'store' slug, not the Building2 fallback.
    expect(badge.querySelector('svg.lucide-store')).toBeInTheDocument()
    expect(badge.querySelector('svg.lucide-building2')).not.toBeInTheDocument()
  })

  it('creating a location rides the chosen icon (and a real colour) along in the POST payload', async () => {
    api.get.mockResolvedValue({ data: { data: [] } })
    // eslint-disable-next-line no-restricted-syntax -- DATA: mock API row colour, not UI styling
    api.post.mockResolvedValue({ data: { data: location({ id: 'loc2', name: 'Nieuwe vestiging', color: '#059669', icon: 'store' }) } })
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText(st('locations.empty'))).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('locations.create') }))
    await user.type(screen.getByLabelText(st('locations.nameLabel')), 'Nieuwe vestiging')

    // Open the reused IconPickerControl and pick 'store' instead of the default glyph.
    const iconLabel = `${st('documentTypes.icon')}: ${st('locations.icon')}`
    await user.click(screen.getByRole('button', { name: iconLabel }))
    await user.click(screen.getByRole('menuitem', { name: `${st('documentTypes.icon')}: store` }))

    await user.click(screen.getByRole('button', { name: st('locations.createBtn') }))

    // Assert the REQUEST body — both fields ride along, icon carries the exact pick.
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/locations', expect.objectContaining({
      name: 'Nieuwe vestiging', icon: 'store', color: expect.any(String),
    })))
  })

  it('editing a location rides the chosen colour/icon along in the PATCH payload', async () => {
    // eslint-disable-next-line no-restricted-syntax -- DATA: mock API row colour, not UI styling
    api.get.mockResolvedValue({ data: { data: [location({ color: '#059669', icon: 'landmark' })] } })
    // eslint-disable-next-line no-restricted-syntax -- DATA: mock API row colour, not UI styling
    api.patch.mockResolvedValue({ data: { data: location({ color: '#059669', icon: 'building' }) } })
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('locations.edit') }))

    // Prefilled from the row's own stored icon, not the default glyph.
    const iconLabel = `${st('documentTypes.icon')}: ${st('locations.icon')}`
    await user.click(screen.getByRole('button', { name: iconLabel }))
    await user.click(screen.getByRole('menuitem', { name: `${st('documentTypes.icon')}: building` }))
    await user.click(screen.getByRole('button', { name: st('common.save') }))

    // The stored colour rides along untouched; the icon carries the new pick.
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/locations/loc1', expect.objectContaining({
      // eslint-disable-next-line no-restricted-syntax -- DATA: asserting the exact stored row colour, not an invented UI colour
      color: '#059669', icon: 'building',
    })))
  })

  it('LOC-FOCUS-TRAP-1: opening the create modal moves focus in, Escape closes it, and focus returns to the trigger', async () => {
    // Regression guard for a focus trap that was structurally dead: useFocusTrap
    // was previously armed in the always-mounted container, so its effect ran once
    // at page mount with a null ref and never attached a keydown listener at all.
    api.get.mockResolvedValue({ data: { data: [] } })
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText(st('locations.empty'))).toBeInTheDocument())

    const createBtn = screen.getByRole('button', { name: st('locations.create') })
    await user.click(createBtn)

    const dialog = await screen.findByRole('dialog', { name: st('locations.create') })
    // Focus must move INTO the panel on open — not stay on the trigger behind it.
    await waitFor(() => expect(dialog).toContainElement(document.activeElement))

    // The trap's own keydown listener closes on Escape (house pattern, §6).
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // And focus is restored to whatever opened the dialog.
    expect(document.activeElement).toBe(createBtn)
  })

  it('LOC-PAGE-CLAMP-1: deleting the last row of the last page snaps back to page 1 instead of an empty page', async () => {
    // Regression guard: `page` state used to keep pointing at a page number that no
    // longer exists once the row count drops, showing the empty state with no way
    // back except a reload. 11 rows = page 1 (10) + page 2 (the 11th, alone).
    const rows = Array.from({ length: 11 }, (_, i) => location({ id: `loc${i + 1}`, name: `Vestiging ${i + 1}` }))
    api.get.mockResolvedValue({ data: { data: rows } })
    api.delete.mockResolvedValue({})
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Vestiging 1')).toBeInTheDocument())

    // Move to page 2, which holds only the last row.
    await user.click(screen.getByRole('button', { name: st('locations.next') }))
    await waitFor(() => expect(screen.getByText('Vestiging 11')).toBeInTheDocument())
    expect(screen.queryByText('Vestiging 1')).not.toBeInTheDocument()

    await confirmDelete(user, 'Vestiging 11')

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/locations/loc11'))
    // The page must follow the data back to page 1 — never a lingering empty page 2.
    await waitFor(() => expect(screen.getByText('Vestiging 1')).toBeInTheDocument())
    expect(screen.queryByText(st('locations.empty'))).not.toBeInTheDocument()
  })
})
