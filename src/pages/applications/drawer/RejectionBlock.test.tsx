/**
 * RejectionBlock — covers S8 (Afwijsreden becomes a searchable CreatableSelect,
 * allowCreate off — a rejection reason is a tenant lookup, never free-typed) and
 * S9 (the toelichting/note is the shared rich-text block, not a bare textarea;
 * an already-rejected application now actually shows its stored reason + note —
 * mapApplicationDetail previously never mapped `rejection` at all, see
 * mapApplication.test.ts). RichTextEditor's own Tiptap internals are out of scope
 * here (stubbed, mirrors MatchPlacementModal.test.tsx) — this test isolates
 * RejectionBlock's own wiring.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RejectionBlock from './RejectionBlock'
import type { ApplicationDetail } from '@/types/application'

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

describe('RejectionBlock', () => {
  it('renders the reason picker as a searchable CreatableSelect (S8), not a bare <select>', async () => {
    render(<RejectionBlock application={app()} />)
    // The shared CreatableSelect toggle button shows the placeholder until a value is picked.
    const toggle = await screen.findByRole('button', { name: 'rejection.reasonPlaceholder' })
    expect(toggle).toBeInTheDocument()
    expect(document.querySelector('select')).toBeNull()
  })

  it('picks a reason and submits reason_id + reason_label', async () => {
    const onReject = vi.fn()
    const user = userEvent.setup()
    render(<RejectionBlock application={app()} onReject={onReject} />)
    await user.click(await screen.findByRole('button', { name: 'rejection.reasonPlaceholder' }))
    await user.click(await screen.findByRole('button', { name: 'Niet gekwalificeerd' }))
    await user.click(screen.getByText('rejection.confirm'))
    expect(onReject).toHaveBeenCalledWith(1, { reason_id: 'r1', note: '', reason_label: 'Niet gekwalificeerd' })
  })

  it('renders the note as the shared rich-text editor (S9), not a bare textarea', async () => {
    render(<RejectionBlock application={app()} />)
    expect(await screen.findByTestId('rte')).toBeInTheDocument()
    expect(document.querySelector('textarea:not([data-testid="rte"])')).toBeNull()
  })

  it('shows a compact summary once rejected — reason label AND the stored note (S9 finding)', () => {
    render(<RejectionBlock application={app({
      bucket: 'rejected',
      rejection: { reason_label: 'Niet gekwalificeerd', note: 'Geen relevante ervaring' },
    })} />)
    expect(screen.getByText('rejection.rejected')).toBeInTheDocument()
    expect(screen.getByText('Niet gekwalificeerd')).toBeInTheDocument()
    expect(screen.getByText('Geen relevante ervaring')).toBeInTheDocument()
  })

  it('shows no note block when the rejection carries none', () => {
    render(<RejectionBlock application={app({ bucket: 'rejected', rejection: { reason_label: 'Te ver weg' } })} />)
    expect(screen.queryByText('rejection.note')).toBeNull()
  })
})
