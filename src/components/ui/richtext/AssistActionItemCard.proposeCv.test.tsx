/**
 * AssistActionItemCard · proposal CV face (PROPOSAL-CV-PANEL-1): the preparing caption while the
 * house-style CV is created, and the cvFailed text with its prepareFailed fallback.
 * Real i18n instance, so the rendered copy is read through the key.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import AssistActionItemCard from './AssistActionItemCard'
import type { ExecItem } from './useAssistActionsExecute'

// The picker is covered by its own suite; here only the card's captions matter.
vi.mock('./ProposalCvPicker', () => ({ default: () => null }))

const pending: ExecItem = {
  title: 'Stel voor', type: 'application_propose', due_date: null, note_excerpt: null,
  status: 'pending', link_type: 'application', link_id: 'a1',
}

describe('AssistActionItemCard · proposal CV face', () => {
  it('shows the preparing caption while the cv is being created', () => {
    render(<AssistActionItemCard item={{ ...pending, preparingCv: true }} onConfirm={() => {}} onCvChange={() => {}} />)
    expect(screen.getByText(i18n.t('common:notesAssist.proposeCv.preparing'))).toBeInTheDocument()
  })

  it('shows no preparing caption when nothing is being prepared', () => {
    render(<AssistActionItemCard item={pending} onConfirm={() => {}} onCvChange={() => {}} />)
    expect(screen.queryByText(i18n.t('common:notesAssist.proposeCv.preparing'))).toBeNull()
  })

  it('shows the cvFailed text the host supplied', () => {
    render(<AssistActionItemCard item={{ ...pending, confirmError: true, confirmErrorKind: 'cvFailed', confirmErrorText: 'No candidate on this application' }} onConfirm={() => {}} />)
    expect(screen.getByText('No candidate on this application')).toBeInTheDocument()
  })

  it('falls back to the prepareFailed copy when cvFailed carries no text', () => {
    render(<AssistActionItemCard item={{ ...pending, confirmError: true, confirmErrorKind: 'cvFailed' }} onConfirm={() => {}} />)
    expect(screen.getByText(i18n.t('common:notesAssist.proposeCv.prepareFailed'))).toBeInTheDocument()
  })
})
