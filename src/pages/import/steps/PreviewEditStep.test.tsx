/**
 * PreviewEditStep — behaviour under test: the per-row verdict column must not keep
 * showing a stale server verdict once the row is edited/re-mapped (`dirty` true) —
 * an "error" row the user just fixed must stop reading "error". `outcomeFor` is
 * gated on `dirty` the same way the confirm report already was.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PreviewEditStep from './PreviewEditStep'
import type { ImportRunResult } from '../api'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// PreviewStep (the confirm report) is irrelevant to the verdict-column behaviour
// under test here and pulls in an unrelated shape (summary/unknownColumns) — stub
// it so this test stays about the grid's own per-row verdict, not that component.
vi.mock('@/pages/settings/shared', () => ({ PreviewStep: () => null }))

const previewResult: ImportRunResult = {
  rows: [{ row: 2, action: 'error' }],
} as unknown as ImportRunResult

function baseProps() {
  return {
    entity: 'candidates',
    targetColumns: ['first_name'],
    mapping: { Voornaam: 'first_name' },
    editableRows: [{ first_name: 'Jan' }],
    onEditCell: vi.fn(),
    onValidate: vi.fn(),
    previewStatus: 'success' as const,
    previewResult,
    runStatus: 'idle' as const,
    canImport: true,
    wholeTree: false,
    onConfirm: vi.fn(),
    onBackToMapping: vi.fn(),
  }
}

describe('PreviewEditStep', () => {
  // A clean (non-dirty) preview shows the last dry-run's real verdict.
  it('shows the server verdict when the rows are not dirty', () => {
    render(<PreviewEditStep {...baseProps()} dirty={false} />)
    expect(screen.getByText('stats.error')).toBeTruthy()
  })

  // Once the rows are dirty (edited or re-mapped since the last dry-run), the stale
  // verdict must not render — it belongs to data that no longer matches the grid.
  it('hides the stale verdict once the rows are dirty', () => {
    render(<PreviewEditStep {...baseProps()} dirty={true} />)
    expect(screen.queryByText('stats.error')).toBeNull()
  })
})
