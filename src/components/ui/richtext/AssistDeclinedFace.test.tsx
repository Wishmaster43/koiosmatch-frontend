/**
 * AssistDeclinedFace — §16 SHARED-UNIT-TEST-1: the shared unit's own
 * behaviour test, proven once here rather than only through its two adopters
 * (AssistActionItemCard, NoteActionsPanel). Mocks i18n so the asserted
 * strings are the raw keys, never a Dutch literal in the test (§5).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssistDeclinedFace from './AssistDeclinedFace'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k }) }))

describe('AssistDeclinedFace', () => {
  it('renders the proposal_in_flight reason by code', () => {
    render(<AssistDeclinedFace code="proposal_in_flight" onForceSend={vi.fn()} />)
    expect(screen.getByText('notesAssist.execute.declined.proposal_in_flight')).toBeInTheDocument()
  })

  it('renders the proposal_recently_sent reason by code', () => {
    render(<AssistDeclinedFace code="proposal_recently_sent" onForceSend={vi.fn()} />)
    expect(screen.getByText('notesAssist.execute.declined.proposal_recently_sent')).toBeInTheDocument()
  })

  it('falls back to the server reason, then the forbidden text, for an unknown code', () => {
    const { rerender } = render(<AssistDeclinedFace code={null} reason="Eigen serverreden" onForceSend={vi.fn()} />)
    expect(screen.getByText('Eigen serverreden')).toBeInTheDocument()
    rerender(<AssistDeclinedFace code={null} onForceSend={vi.fn()} />)
    expect(screen.getByText('Geen rechten')).toBeInTheDocument()
  })

  it('shows the existing-proposal chip only with both a proposalId and an applicationId', () => {
    const { rerender } = render(<AssistDeclinedFace code="proposal_in_flight" onForceSend={vi.fn()} />)
    expect(screen.queryByText('notesAssist.execute.openProposal')).not.toBeInTheDocument()
    rerender(<AssistDeclinedFace code="proposal_in_flight" proposalId="prop-1" onForceSend={vi.fn()} />)
    expect(screen.queryByText('notesAssist.execute.openProposal')).not.toBeInTheDocument()
    rerender(<AssistDeclinedFace code="proposal_in_flight" proposalId="prop-1" applicationId="app-1" onForceSend={vi.fn()} />)
    expect(screen.getByText('notesAssist.execute.openProposal')).toBeInTheDocument()
  })

  it('calls onForceSend when the force-send button is clicked', async () => {
    const user = userEvent.setup()
    const onForceSend = vi.fn()
    render(<AssistDeclinedFace code="proposal_in_flight" onForceSend={onForceSend} />)
    await user.click(screen.getByRole('button', { name: 'notesAssist.execute.forceSend' }))
    expect(onForceSend).toHaveBeenCalledTimes(1)
  })

  it('disables the force-send button while confirming', () => {
    render(<AssistDeclinedFace code="proposal_in_flight" confirming onForceSend={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'notesAssist.execute.forceSend' })).toBeDisabled()
  })
})
