/**
 * NoteActionItemRow · proposal CV face (PROPOSAL-CV-PANEL-1): the preparing caption while the
 * house-style CV is created, and the cvFailed text with its prepareFailed fallback (key echo).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import NoteActionItemRow from './NoteActionItemRow'
import type { NoteActionPanelItem } from './NoteActionsPanel'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/components/ui/richtext/ProposalCvPicker', () => ({ default: () => null }))

const pending: NoteActionPanelItem = {
  title: 'Stel voor', type: 'application_propose', due_date: null, note_excerpt: null,
  status: 'pending', link_type: 'application', link_id: 'a1',
}
const renderRow = (item: NoteActionPanelItem) =>
  render(<NoteActionItemRow item={item} index={0} onEdit={() => {}} onConfirm={() => {}} formatNumber={n => String(n)} />)

describe('NoteActionItemRow · proposal CV face', () => {
  it('shows the preparing caption while the cv is being created', () => {
    renderRow({ ...pending, preparingCv: true })
    expect(screen.getByText('notesAssist.proposeCv.preparing')).toBeInTheDocument()
  })

  it('shows no preparing caption when nothing is being prepared', () => {
    renderRow(pending)
    expect(screen.queryByText('notesAssist.proposeCv.preparing')).toBeNull()
  })

  it('shows the cvFailed text the host supplied', () => {
    renderRow({ ...pending, confirmError: true, confirmErrorKind: 'cvFailed', confirmErrorText: 'No candidate on this application' })
    expect(screen.getByText('No candidate on this application')).toBeInTheDocument()
  })

  it('falls back to the prepareFailed key when cvFailed carries no text', () => {
    renderRow({ ...pending, confirmError: true, confirmErrorKind: 'cvFailed' })
    expect(screen.getByText('notesAssist.proposeCv.prepareFailed')).toBeInTheDocument()
  })
})
