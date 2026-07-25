/**
 * RejectionModal — covers S8 (Afwijsreden becomes a searchable CreatableSelect,
 * allowCreate off — a rejection reason is a tenant lookup, never free-typed) and
 * S9 (the toelichting/note is the shared rich-text block, not a bare textarea).
 * Moved from the old RejectionBlock (deleted, Danny 25-07: the reject form is
 * now a footer button + confirm modal). RichTextEditor's own Tiptap internals
 * are out of scope here (stubbed, mirrors MatchPlacementModal.test.tsx).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RejectionModal from './RejectionModal'
import type { ApplicationDetail } from '@/types/application'

// Key-echo (repo-wide precedent, e.g. ApplicationTab.test.tsx) — without it,
// i18n's real (async-initialising) instance can finish loading mid-suite once
// another file in the run awaits a promise, flipping assertions from raw keys
// to actual NL copy depending on run order.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

const { mockReasons } = vi.hoisted(() => ({
  mockReasons: [{ id: 'r1', name: 'Niet gekwalificeerd' }, { id: 'r2', name: 'Te ver weg' }],
}))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: mockReasons } })) },
  unwrapList: (res: { data?: { data?: unknown[] } }) =>
    ({ rows: res?.data?.data ?? [], total: 0, page: 1, lastPage: 1, perPage: 0 }),
}))

const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, bucket: 'active', ai: {}, ...over,
} as unknown as ApplicationDetail)

describe('RejectionModal', () => {
  it('renders the reason picker as a searchable CreatableSelect (S8), not a bare <select>', async () => {
    render(<RejectionModal application={app()} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    const toggle = await screen.findByRole('button', { name: 'rejection.reasonPlaceholder' })
    expect(toggle).toBeInTheDocument()
    expect(document.querySelector('select')).toBeNull()
  })

  it('disables the confirm button until a reason is picked', async () => {
    render(<RejectionModal application={app()} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    await screen.findByRole('button', { name: 'rejection.reasonPlaceholder' })
    expect(screen.getByText('rejection.confirm').closest('button')).toBeDisabled()
  })

  it('picks a reason and confirms with exactly { reason_id, note, reason_label }', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<RejectionModal application={app()} onCancel={vi.fn()} onConfirm={onConfirm} />)
    await user.click(await screen.findByRole('button', { name: 'rejection.reasonPlaceholder' }))
    await user.click(await screen.findByRole('button', { name: 'Niet gekwalificeerd' }))
    await user.click(screen.getByText('rejection.confirm'))
    expect(onConfirm).toHaveBeenCalledWith({ reason_id: 'r1', note: '', reason_label: 'Niet gekwalificeerd' })
  })

  it('Annuleren calls onCancel and never onConfirm', async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<RejectionModal application={app()} onCancel={onCancel} onConfirm={onConfirm} />)
    await screen.findByRole('button', { name: 'rejection.reasonPlaceholder' })
    await user.click(screen.getByText('common:cancel'))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  // Danny 21-07: the toelichting collapses by default (profile-text pattern) —
  // the rich-text editor only appears once the pencil is clicked.
  it('keeps the toelichting collapsed until the pencil is clicked, then shows the shared rich-text editor', async () => {
    const user = userEvent.setup()
    render(<RejectionModal application={app()} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText('rejection.notePlaceholder')).toBeInTheDocument()
    expect(screen.queryByTestId('rte')).toBeNull()
    await user.click(screen.getByLabelText('rejection.editNote'))
    expect(await screen.findByTestId('rte')).toBeInTheDocument()
  })

  it('submits the typed note along with the picked reason', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<RejectionModal application={app()} onCancel={vi.fn()} onConfirm={onConfirm} />)
    await user.click(screen.getByLabelText('rejection.editNote'))
    await user.type(screen.getByTestId('rte'), 'Geen relevante ervaring')
    await user.click(screen.getByLabelText('common:save'))
    await user.click(await screen.findByRole('button', { name: 'rejection.reasonPlaceholder' }))
    await user.click(await screen.findByRole('button', { name: 'Niet gekwalificeerd' }))
    await user.click(screen.getByText('rejection.confirm'))
    expect(onConfirm).toHaveBeenCalledWith({ reason_id: 'r1', note: 'Geen relevante ervaring', reason_label: 'Niet gekwalificeerd' })
  })
})
