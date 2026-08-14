/**
 * OutreachTargetNotePopout — BELLIJST-NOTE-POPOUT-1: four UI states + the seam
 * that actually matters, saving issues the REAL PATCH /outreach-targets/{id}
 * (§13). Mirrors CustomerDepartmentTextPopout.test.tsx — same composite-id
 * recipe, one level of "no standalone GET" deeper.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OutreachTargetNotePopout from './OutreachTargetNotePopout'
import api from '@/lib/api'

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (html: string) => void }) => (
    <textarea aria-label="editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))
// The Koios assist block is heavy (its own hook/API call) — stubbed exactly like
// TargetNoteField.test.tsx; this suite proves the LOAD/SAVE seam, not the assist modes.
vi.mock('@/components/drawer/tabs/notes/NoteAssistSection', () => ({ default: () => <div data-testid="assist-stub" /> }))
vi.mock('@/lib/api', () => ({
  default: { patch: vi.fn(() => Promise.resolve({ data: {} })), get: vi.fn() },
  unwrap: (r: { data: unknown }) => r.data,
  unwrapList: (r: { data: unknown }) => ({ rows: r.data }),
  getActiveTenantId: () => 'demo',
}))

const { liteState } = vi.hoisted(() => ({
  liteState: {
    target: null as { id: string; campaignId: string; candidateName: string; note: string } | null,
    loading: false, error: false, reload: vi.fn(),
  },
}))
vi.mock('../hooks/useOutreachTargetTextPopout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useOutreachTargetTextPopout')>()
  return { ...actual, useOutreachTargetTextLite: () => liteState }
})

describe('OutreachTargetNotePopout', () => {
  const previousTitle = document.title
  beforeEach(() => {
    liteState.target = null
    liteState.loading = false
    liteState.error = false
    liteState.reload = vi.fn()
    vi.mocked(api.patch).mockClear()
  })
  afterEach(() => { document.title = previousTitle })

  // A malformed/legacy id (no `<campaignId>:<targetId>` pair) — an honest error
  // state, never a wrong fetch (§3).
  it('shows an error for a malformed composite id', () => {
    render(<OutreachTargetNotePopout id="not-composite" />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('shows a loading skeleton while the target loads', () => {
    liteState.loading = true
    render(<OutreachTargetNotePopout id="camp-1:t1" />)
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows an error with a retry that re-runs the fetch', async () => {
    const user = userEvent.setup()
    liteState.error = true
    render(<OutreachTargetNotePopout id="camp-1:t1" />)
    await user.click(screen.getByRole('button'))
    expect(liteState.reload).toHaveBeenCalled()
  })

  // CRITICAL: the window must load the target's CURRENT note, never an empty
  // editor that would then PATCH over the real value on save.
  it('loads the stored note into the editor and starts clean', () => {
    liteState.target = { id: 't1', campaignId: 'camp-1', candidateName: 'Jan Jansen', note: '<p>Bel na 17u</p>' }
    render(<OutreachTargetNotePopout id="camp-1:t1" />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByLabelText('editor')).toHaveValue('<p>Bel na 17u</p>')
    expect(screen.getByTestId('text-popout-save')).toBeDisabled()
  })

  it('PATCHes /outreach-targets/{id} with the edited note and then closes the window', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    liteState.target = { id: 't1', campaignId: 'camp-1', candidateName: 'Jan Jansen', note: 'a' }
    render(<OutreachTargetNotePopout id="camp-1:t1" />)
    await user.type(screen.getByLabelText('editor'), 'b')
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalledWith('/outreach-targets/t1', { note: 'ab' })
    expect(close).toHaveBeenCalled()
    close.mockRestore()
  })

  it('keeps the window open when the server refuses the write', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { status: 422 } })
    liteState.target = { id: 't1', campaignId: 'camp-1', candidateName: 'Jan Jansen', note: 'a' }
    render(<OutreachTargetNotePopout id="camp-1:t1" />)
    await user.type(screen.getByLabelText('editor'), 'b')
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    close.mockRestore()
  })
})
