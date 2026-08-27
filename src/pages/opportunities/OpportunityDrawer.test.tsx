/**
 * OpportunityDrawer — the title-row reference number chip (NUMMER-3): the API now
 * sends OpportunityResource::reference_number on every row (measured), so the
 * drawer shows it as a copy chip right after the title, before the phase badge —
 * same anatomy as the customer contact/location drawers (§3A). The shared
 * ReferenceNumberChip renders nothing when the value is empty.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (nl) init so t() resolves genuine Dutch text.
import i18n from '@/i18n'
import api from '@/lib/api'
import OpportunityDrawer from './OpportunityDrawer'
import { mapOpportunity } from './data/mapOpportunity'

// TRASH-OVERAL-2: api + the grace-window read serve the shared TrashLifecycleSection
// (deletion-preview GET, mark/unmark POSTs) rendered via the `trash` prop.
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: { data: { lifecycle: 'pending_erase' } } })),
  },
  unwrap: (res: { data?: unknown }) => {
    const body = res?.data
    return body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body
  },
}))
vi.mock('@/pages/settings/lib/settingsApi', () => ({
  loadSettings: () => Promise.resolve({ deletion_grace_days: '30' }),
}))

// Heavy tab bodies are out of scope for this title-row test — stub them out.
vi.mock('./drawer/DetailsTab', () => ({ default: () => null }))
vi.mock('./drawer/CustomerRelationTab', () => ({ default: () => null }))
vi.mock('./drawer/NotesTab', () => ({ default: () => null }))
vi.mock('./drawer/TasksTab', () => ({ default: () => null }))
vi.mock('./drawer/ConversationTab', () => ({ default: () => null }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))

const noop = () => {}

describe('OpportunityDrawer — reference number chip', () => {
  it('shows the copy chip when reference_number is present', () => {
    const o = mapOpportunity({ id: 'o1', title: 'Deal A', reference_number: 'D-42' })
    render(<OpportunityDrawer opportunity={o} onClose={noop} />)
    expect(screen.getByText('D-42')).toBeInTheDocument()
  })

  it('renders nothing when reference_number is absent', () => {
    const o = mapOpportunity({ id: 'o2', title: 'Deal B' })
    render(<OpportunityDrawer opportunity={o} onClose={noop} />)
    expect(screen.queryByText(/^D-/)).toBeNull()
  })
})

// Danny 24-08: the Conversatie tab sits where E-mails used to, and Statistieken
// stays last (§3A canon) — pin the whole order so a future edit can't drift it.
describe('OpportunityDrawer — tab order (conversation replaces e-mails)', () => {
  it('shows Conversatie where E-mails used to sit, with Timeline then Statistieken last', () => {
    const o = mapOpportunity({ id: 'o3', title: 'Deal C' })
    render(<OpportunityDrawer opportunity={o} onClose={noop} />)
    const tabLabels = screen.getAllByRole('tab').map(t => t.textContent)
    // Literal label: a raw-key render (missing i18n) must FAIL, never round-trip.
    const timelineLabel = 'Tijdlijn'
    expect(tabLabels).toEqual(['Details', 'Klant', 'Notities', 'Conversatie', 'Taken', timelineLabel, 'Statistieken'])
  })
})

// TIJDLIJN-OVERAL (27-08): the new tab reuses the same ChangelogTab content the
// title-row popover renders — assert the real activity request fires when opened.
describe('OpportunityDrawer · Timeline tab (TIJDLIJN-OVERAL)', () => {
  it('fetches the opportunity activity feed when the Timeline tab opens', async () => {
    const o = mapOpportunity({ id: 'o4', title: 'Deal D' })
    const user = userEvent.setup()
    render(<OpportunityDrawer opportunity={o} onClose={noop} />)

    await user.click(screen.getByRole('tab', { name: 'Tijdlijn' }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/opportunities/o4/activity', expect.anything()))
  })
})

// TRASH-OVERAL-2: the drawer's trash surface — REQUEST-asserting (§13): the exact
// mark POST with and without transfer_to_owner_id, the unmark POST, and the
// permission-hidden mark action (opportunities.delete / .update via the page).
describe('OpportunityDrawer · trash lifecycle (TRASH-OVERAL-2)', () => {
  const tc = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })
  const PREVIEW = { blocking: [], transferable: null, can_mark: true, lifecycle: 'archived' }
  const trashWiring = (over: Partial<Record<string, unknown>> = {}) => ({
    canMark: true, canUnmark: true,
    users: [{ value: 'u-1', label: 'Anna de Vries' }],
    onMarked: vi.fn(), onUnmarked: vi.fn(), ...over,
  })
  const deal = () => mapOpportunity({ id: 'o1', title: 'Deal A' })

  it('mark flow: preview GET + confirm POSTs /opportunities/{id}/mark-deletion with an EMPTY body', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: PREVIEW } })
    const wiring = trashWiring()
    const user = userEvent.setup()
    // TRASH-ARCHIEF-EERST-1: hard delete only exists on an ARCHIVED record now.
    render(<OpportunityDrawer opportunity={{ ...deal(), archived: true, lifecycle: 'archived' }} onClose={noop} trash={wiring} />)

    await user.click(screen.getByRole('button', { name: tc('trash.markAction') as string }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/opportunities/o1/deletion-preview'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: tc('trash.modal.confirm') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/opportunities/o1/mark-deletion', {}, { quietStatuses: [409] }))
    expect(wiring.onMarked).toHaveBeenCalledWith('o1')
  })

  it('mark flow with a picked transfer owner sends {transfer_to_owner_id}', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { ...PREVIEW, transferable: { attribute: 'owner_id', current_owner_id: null } } } })
    const user = userEvent.setup()
    render(<OpportunityDrawer opportunity={{ ...deal(), archived: true, lifecycle: 'archived' }} onClose={noop} trash={trashWiring()} />)

    await user.click(screen.getByRole('button', { name: tc('trash.markAction') as string }))
    await user.click(await screen.findByText(tc('trash.modal.transferPlaceholder') as string))
    await user.click(screen.getByText('Anna de Vries'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: tc('trash.modal.confirm') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/opportunities/o1/mark-deletion',
      { transfer_to_owner_id: 'u-1' }, { quietStatuses: [409] }))
  })

  it('hides the mark action without opportunities.delete (no fake affordances)', () => {
    render(<OpportunityDrawer opportunity={deal()} onClose={noop} trash={trashWiring({ canMark: false })} />)
    expect(screen.queryByRole('button', { name: tc('trash.markAction') as string })).toBeNull()
  })

  it('unmark on a pending_erase record POSTs /opportunities/{id}/unmark-deletion', async () => {
    const wiring = trashWiring()
    const pending = mapOpportunity({ id: 'o1', title: 'Deal A', deleted_at: '2026-08-01T10:00:00Z', pending_erase_at: '2026-08-02T10:00:00Z' })
    const user = userEvent.setup()
    render(<OpportunityDrawer opportunity={pending} onClose={noop} trash={wiring} />)

    await user.click(screen.getByRole('button', { name: tc('trash.unmarkAction') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/opportunities/o1/unmark-deletion'))
    expect(wiring.onUnmarked).toHaveBeenCalledWith('o1')
  })
})
