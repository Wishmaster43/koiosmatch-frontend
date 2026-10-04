/**
 * AssistActionItemCard — regression for the budget_exceeded unit label
 * (K-242): the raw backend enum key ('workflow_run'/'koios_ai_token') must
 * never reach the tenant untranslated in the "{{used}}/{{allowance}} {{unit}}"
 * line. Uses the REAL i18n singleton (no react-i18next mock) so the
 * interpolated OUTPUT is what gets asserted, not a mocked passthrough.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssistActionItemCard from './AssistActionItemCard'
import type { ExecItem } from './useAssistActionsExecute'

const BASE_ITEM: ExecItem = {
  title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null,
}

describe('AssistActionItemCard — budget_exceeded unit label', () => {
  it('translates the raw workflow_run unit key into its house label', () => {
    render(
      <AssistActionItemCard
        item={{
          ...BASE_ITEM, status: 'budget_exceeded', reason: 'Workflow-staffel is vol.',
          budget: { state: 'blocked', allowance: 100, used: 100, remaining: 0, unit: 'workflow_run' },
        }}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByText('100/100 Workflow-tokens')).toBeInTheDocument()
    expect(screen.queryByText(/workflow_run/)).not.toBeInTheDocument()
  })

  it('translates the raw koios_ai_token unit key into its house label', () => {
    render(
      <AssistActionItemCard
        item={{
          ...BASE_ITEM, status: 'budget_exceeded', reason: 'Budget op.',
          budget: { state: 'blocked', allowance: 50, used: 50, remaining: 0, unit: 'koios_ai_token' },
        }}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByText('50/50 Koios AI-tokens')).toBeInTheDocument()
    expect(screen.queryByText(/koios_ai_token/)).not.toBeInTheDocument()
  })

  it('falls back to the raw unit only for an unknown key (no crash, no blank)', () => {
    render(
      <AssistActionItemCard
        item={{
          ...BASE_ITEM, status: 'budget_exceeded', reason: 'Budget op.',
          budget: { state: 'blocked', allowance: 5, used: 5, remaining: 0, unit: 'some_future_unit' },
        }}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByText('5/5 some_future_unit')).toBeInTheDocument()
  })
})

// CONFIRM-EERLIJK-1: the pending card names why a confirm did not land.
describe('AssistActionItemCard — confirm error copy per kind', () => {
  it('says the session expired on a 401/419 confirm', () => {
    render(<AssistActionItemCard item={{ ...BASE_ITEM, status: 'pending', confirmError: true, confirmErrorKind: 'sessionExpired' }} onConfirm={() => {}} />)
    expect(screen.getByText('Sessie verlopen: log opnieuw in en bevestig nogmaals')).toBeInTheDocument()
  })

  it('says the server did not apply the confirm when it answered pending again', () => {
    render(<AssistActionItemCard item={{ ...BASE_ITEM, status: 'pending', confirmError: true, confirmErrorKind: 'notApplied' }} onConfirm={() => {}} />)
    expect(screen.getByText('De server nam de bevestiging niet aan, probeer het nogmaals')).toBeInTheDocument()
  })
})

// CLAIM-1 (03-10): the two new per-item statuses — a transient claim and a
// duplicate-propose decline — each get their own card face.
describe('AssistActionItemCard — executing/declined (CLAIM-1)', () => {
  it('renders a spinner + "Wordt uitgevoerd…" for executing, no buttons', () => {
    render(<AssistActionItemCard item={{ ...BASE_ITEM, status: 'executing' }} onConfirm={() => {}} />)
    expect(screen.getByText('Wordt uitgevoerd…')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders the proposal_in_flight reason and calls onConfirm(true) from the force-send button', async () => {
    const onConfirm = vi.fn()
    render(<AssistActionItemCard item={{ ...BASE_ITEM, status: 'declined', code: 'proposal_in_flight', reason: 'Wacht op bevestiging.' }} onConfirm={onConfirm} />)
    expect(screen.getByText('Voorstel wordt al verstuurd')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Toch versturen'))
    expect(onConfirm).toHaveBeenCalledWith(true)
  })

  it('renders the proposal_recently_sent reason', () => {
    render(<AssistActionItemCard item={{ ...BASE_ITEM, status: 'declined', code: 'proposal_recently_sent' }} onConfirm={() => {}} />)
    expect(screen.getByText('Voorstel is recent al verstuurd')).toBeInTheDocument()
  })

  it('shows the existing-proposal chip only when proposal_id AND an application link are both present', () => {
    const { rerender } = render(
      <AssistActionItemCard item={{ ...BASE_ITEM, status: 'declined', code: 'proposal_recently_sent', proposal_id: 'p1' }} onConfirm={() => {}} />,
    )
    expect(screen.queryByText('Bestaand voorstel')).not.toBeInTheDocument()
    rerender(
      <AssistActionItemCard
        item={{ ...BASE_ITEM, status: 'declined', code: 'proposal_recently_sent', proposal_id: 'p1', link_type: 'application', link_id: 'a1' }}
        onConfirm={() => {}} />,
    )
    expect(screen.getByText('Bestaand voorstel')).toBeInTheDocument()
  })

  // KOIOS-DEDUPE-1: the item's `ref` reaches AssistDeclinedFace as `existingRef`.
  it('passes a duplicate decline\'s ref through to the existing-record chip', () => {
    render(
      <AssistActionItemCard
        item={{ ...BASE_ITEM, status: 'declined', code: 'duplicate_customer', ref: { type: 'customer', id: 'cust-1' } }}
        onConfirm={() => {}} />,
    )
    expect(screen.getByText('Bekijk bestaand record')).toBeInTheDocument()
  })
})
