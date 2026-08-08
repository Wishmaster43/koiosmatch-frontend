/**
 * MatchRemarksBlock — REMARKS-INTO-NOTES-1 (Danny 09-08). Opmerkingen is retired
 * as an editable field; Matchtekst is the one free-text field on a match. These
 * tests hold the two promises that matter:
 *   1. no second free-text EDITOR is offered anymore (no pencil, no editor, and
 *      nothing at all once the field is empty), and
 *   2. existing content is never lost — it stays readable, and the move writes
 *      the REAL request first (POST /matches/{id}/notes) and only then clears the
 *      old field (§13: assert the request shape, not that a callback fired).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchRemarksBlock from './MatchRemarksBlock'

// Only the default client is stubbed; the note-type lookup falls back to its seed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: [] })), post: vi.fn(() => Promise.resolve({ data: {} })) } }
})
// Toasts are assertable rather than rendered.
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// The tenant note-type lookup is not the seam under test; stubbing it keeps the
// chosen type explicit (the block must send the FIRST writable option) and keeps
// the block's render synchronous. OverviewTab.test.tsx exercises the real hook.
vi.mock('@/lib/useNoteTypes', () => ({
  useNoteTypes: () => ({ writableTypes: [{ value: 'general', label: 'Algemeen' }, { value: 'issue', label: 'Knelpunt' }] }),
}))

import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

const REMARK = '<p>Contact opnemen na 3 maanden</p>'

beforeEach(() => {
  vi.clearAllMocks()
  mockPost.mockResolvedValue({ data: {} })
})

describe('MatchRemarksBlock (retired field, read-only)', () => {
  it('renders nothing at all when the legacy field is empty — no second free-text field', () => {
    const { container } = render(<MatchRemarksBlock remarks={null} loading={false} save={vi.fn()} matchId="m1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing while the shared contract fetch is still in flight', () => {
    const { container } = render(<MatchRemarksBlock remarks={REMARK} loading save={vi.fn()} matchId="m1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('keeps existing remarks readable, with a translated notice that the field is going away', () => {
    render(<MatchRemarksBlock remarks={REMARK} loading={false} save={vi.fn()} matchId="m1" />)
    expect(screen.getByText('Contact opnemen na 3 maanden')).toBeInTheDocument()
    expect(screen.getByText('drawer.remarks.deprecated')).toBeInTheDocument()
  })

  it('offers no editor anymore: no pencil, no save/cancel icons', () => {
    render(<MatchRemarksBlock remarks={REMARK} loading={false} save={vi.fn()} matchId="m1" />)
    expect(screen.queryByTitle('common:edit')).toBeNull()
    expect(screen.queryByTitle('common:save')).toBeNull()
    expect(screen.queryByTitle('common:cancel')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('moves the text into a note: POST /matches/{id}/notes with the exact body, THEN clears the old field', async () => {
    const user = userEvent.setup()
    const save = vi.fn().mockResolvedValue(undefined)
    const onOpenNotes = vi.fn()
    render(<MatchRemarksBlock remarks={REMARK} loading={false} save={save} matchId="m1" onOpenNotes={onOpenNotes} />)

    await user.click(screen.getByRole('button', { name: /drawer\.remarks\.moveToNotes/ }))

    // The seeded note-type list is used, so the note carries a real, valid type.
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/matches/m1/notes', { type: 'general', body: REMARK }))
    // Clearing only happens AFTER the note request resolved.
    await waitFor(() => expect(save).toHaveBeenCalledWith({ remarks: null }))
    expect(notifySuccess).toHaveBeenCalledWith('drawer.remarks.moved')
    expect(onOpenNotes).toHaveBeenCalled()
  })

  it('never clears the old field when writing the note fails — the text stays readable', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    mockPost.mockRejectedValueOnce({ response: { data: { message: 'Nope' } } })
    render(<MatchRemarksBlock remarks={REMARK} loading={false} save={save} matchId="m1" />)

    await user.click(screen.getByRole('button', { name: /drawer\.remarks\.moveToNotes/ }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Nope'))
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByText('Contact opnemen na 3 maanden')).toBeInTheDocument()
  })

  it('says so honestly when the note was written but clearing the old field failed (content exists twice, not lost)', async () => {
    const user = userEvent.setup()
    const save = vi.fn().mockRejectedValue({ response: { data: {} } })
    render(<MatchRemarksBlock remarks={REMARK} loading={false} save={save} matchId="m1" />)

    await user.click(screen.getByRole('button', { name: /drawer\.remarks\.moveToNotes/ }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('drawer.remarks.moveClearError'))
    expect(mockPost).toHaveBeenCalled()
    expect(screen.getByText('Contact opnemen na 3 maanden')).toBeInTheDocument()
  })

  it('disables the move when there is no match id (the notes route is per match) — no silent no-op', () => {
    render(<MatchRemarksBlock remarks={REMARK} loading={false} save={vi.fn()} />)
    expect(screen.getByRole('button', { name: /drawer\.remarks\.moveToNotes/ })).toBeDisabled()
  })
})
