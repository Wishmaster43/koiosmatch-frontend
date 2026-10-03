import { describe, it, expect } from 'vitest'
import { mappedValueLabel } from './mappedValueLabel'
import type { WorkflowVarGroup } from '@/types/workflow'

const groups: WorkflowVarGroup[] = [
  { nodeId: 'a', moduleType: 'sm_candidates', customName: '2. SM employees', hasRun: true,
    fields: [{ token: '{{2.status}}', label: 'status', sample: 'Status' }] },
]

describe('mappedValueLabel', () => {
  it('resolves a known token to "module · field"', () => {
    expect(mappedValueLabel('{{2.status}}', groups)).toBe('2. SM employees · Status')
  })

  it('returns null for a plain literal', () => {
    expect(mappedValueLabel('actief', groups)).toBeNull()
  })

  it('returns null for a token no upstream group carries any more', () => {
    expect(mappedValueLabel('{{9.gone}}', groups)).toBeNull()
  })

  // ADDENDUM 1/2: a stored token may carry a trailing "|format" suffix — the
  // label still resolves by matching the bare number+field underneath it.
  it('resolves a token with a trailing |format suffix', () => {
    expect(mappedValueLabel('{{2.status|datum}}', groups)).toBe('2. SM employees · Status')
  })

  // The bare form (no "N." prefix) matches a group field by its LABEL instead.
  it('resolves a bare token (no module number) by field label', () => {
    expect(mappedValueLabel('{{status}}', groups)).toBe('2. SM employees · Status')
  })
})
