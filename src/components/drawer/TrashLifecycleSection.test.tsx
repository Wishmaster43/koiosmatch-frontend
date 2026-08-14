/**
 * TrashLifecycleSection (TRASH-OVERAL-2) — behavioural, REQUEST-asserting (§13):
 * the mark flow sends POST /{entity}/{id}/mark-deletion with and without
 * transfer_to_owner_id, the banner's unmark sends POST /{entity}/{id}/unmark-deletion,
 * both actions are HIDDEN without their permission, and the pending banner shows
 * the projected erase date in DD-MM-YYYY.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import TrashLifecycleSection from './TrashLifecycleSection'
import { __resetDeletionGraceCache } from '@/hooks/useDeletionLifecycle'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  // Minimal stand-in for the shared adapter: unwrap a { data: { data } } resource.
  unwrap: (res: { data?: unknown }) => {
    const body = res?.data
    return body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body
  },
}))
// The tenant grace window (30 days) — mocked at the settings seam so the hook's
// module cache never touches the real settings client.
vi.mock('@/pages/settings/lib/settingsApi', () => ({
  loadSettings: () => Promise.resolve({ deletion_grace_days: '30' }),
}))
// Toasts are side effects, not this test's subject.
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

const PREVIEW = { blocking: [], transferable: null, can_mark: true, lifecycle: 'archived' }

// Default wiring; individual tests override what they probe.
function renderSection(over: Partial<Parameters<typeof TrashLifecycleSection>[0]> = {}) {
  const onMarked = vi.fn()
  const onUnmarked = vi.fn()
  render(
    <TrashLifecycleSection entityPath="customers" id="c-1" entityLabel="Jansen B.V."
      lifecycle="archived" pendingEraseAt={null}
      canMark canUnmark users={[{ value: 'u-1', label: 'Anna de Vries' }]}
      onMarked={onMarked} onUnmarked={onUnmarked} {...over} />,
  )
  return { onMarked, onUnmarked }
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetDeletionGraceCache()
  vi.mocked(api.get).mockResolvedValue({ data: { data: PREVIEW } })
  vi.mocked(api.post).mockResolvedValue({ data: { data: { lifecycle: 'pending_erase' } } })
})

describe('TrashLifecycleSection — mark flow', () => {
  it('opens the preview modal (GET deletion-preview) and confirm POSTs mark-deletion with an EMPTY body', async () => {
    const user = userEvent.setup()
    const { onMarked } = renderSection()
    await user.click(screen.getByRole('button', { name: t('trash.markAction') as string }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers/c-1/deletion-preview'))
    // Scope to the dialog: the trigger button carries the same "Definitief
    // verwijderen" label as the modal's confirm button.
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('trash.modal.confirm') as string }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/customers/c-1/mark-deletion', {}, { quietStatuses: [409] }))
    expect(onMarked).toHaveBeenCalledWith('c-1')
  })

  it('sends {transfer_to_owner_id} when an owner is picked in the transfer picker', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { ...PREVIEW, transferable: { attribute: 'owner_id', current_owner_id: null } } } })
    const user = userEvent.setup()
    renderSection()
    await user.click(screen.getByRole('button', { name: t('trash.markAction') as string }))
    await user.click(await screen.findByText(t('trash.modal.transferPlaceholder') as string))
    await user.click(screen.getByText('Anna de Vries'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('trash.modal.confirm') as string }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/customers/c-1/mark-deletion',
      { transfer_to_owner_id: 'u-1' }, { quietStatuses: [409] }))
  })

  it('hides the mark action without the delete permission (no fake affordances)', () => {
    renderSection({ canMark: false })
    expect(screen.queryByRole('button', { name: t('trash.markAction') as string })).toBeNull()
  })
})

describe('TrashLifecycleSection — pending_erase banner', () => {
  it('shows the DD-MM-YYYY erase projection and unmark POSTs unmark-deletion', async () => {
    const user = userEvent.setup()
    const { onUnmarked } = renderSection({
      entityPath: 'vacancies', id: 'v-9', lifecycle: 'pending_erase', pendingEraseAt: '2026-08-01T10:00:00Z',
    })
    // pending_erase_at + 30 grace days → 31-08-2026, via the house formatter.
    await waitFor(() => expect(screen.getByText(new RegExp('31-08-2026'))).toBeInTheDocument())
    // The mark action never shows on a row already in the trash.
    expect(screen.queryByRole('button', { name: t('trash.markAction') as string })).toBeNull()
    await user.click(screen.getByRole('button', { name: t('trash.unmarkAction') as string }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/vacancies/v-9/unmark-deletion'))
    expect(onUnmarked).toHaveBeenCalledWith('v-9')
  })

  it('hides the unmark action without the update permission', () => {
    renderSection({ lifecycle: 'pending_erase', pendingEraseAt: '2026-08-01T10:00:00Z', canUnmark: false })
    expect(screen.queryByRole('button', { name: t('trash.unmarkAction') as string })).toBeNull()
  })
})
