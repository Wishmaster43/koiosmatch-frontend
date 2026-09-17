/**
 * AssistActionItemCard — regression for the budget_exceeded unit label
 * (K-242): the raw backend enum key ('workflow_run'/'koios_ai_token') must
 * never reach the tenant untranslated in the "{{used}}/{{allowance}} {{unit}}"
 * line. Uses the REAL i18n singleton (no react-i18next mock) so the
 * interpolated OUTPUT is what gets asserted, not a mocked passthrough.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
