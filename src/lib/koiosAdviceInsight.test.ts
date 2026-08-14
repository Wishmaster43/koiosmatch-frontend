import { describe, it, expect } from 'vitest'
import { adviceInsightRows } from './koiosAdviceInsight'
import { ADVICE_META } from './koiosAdviceMeta'

// KOIOS-ADVIES-OVERAL-1: one mapper turns the table's resolved advice into the
// drawer block's row — these tests pin the label/colour/empty contract every
// entity drawer relies on.
describe('adviceInsightRows', () => {
  it('maps a resolved advice to ONE row carrying the pill label and the shared meta colour', () => {
    const rows = adviceInsightRows({ action: 'renew', label: 'Verlengen?', reason: 'De einddatum nadert.', source: 'rules' })
    expect(rows).toEqual([{ type: 'Verlengen?', color: ADVICE_META.renew.color, text: 'De einddatum nadert.' }])
  })

  it('returns [] for null/undefined/none advice so callers render no empty row', () => {
    expect(adviceInsightRows(null)).toEqual([])
    expect(adviceInsightRows(undefined)).toEqual([])
    expect(adviceInsightRows({ action: 'none' })).toEqual([])
    expect(adviceInsightRows({})).toEqual([])
  })

  it('repeats the label as the text for label-only advice (applications AI task)', () => {
    const rows = adviceInsightRows({ action: 'task', label: 'Bel de kandidaat terug', source: 'rules' })
    expect(rows).toEqual([{ type: 'Bel de kandidaat terug', color: ADVICE_META.task.color, text: 'Bel de kandidaat terug' }])
  })

  it('falls back to the default meta colour for an unknown (future backend) action', () => {
    const rows = adviceInsightRows({ action: 'future_action', label: 'X', source: 'engine' })
    expect(rows[0].color).toBe(ADVICE_META.default.color)
  })
})
