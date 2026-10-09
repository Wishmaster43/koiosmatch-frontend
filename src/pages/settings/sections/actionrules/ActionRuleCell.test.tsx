import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { chipInk } from '@/lib/tint'
import ActionRuleCell from './ActionRuleCell'

// A locked cell must stay fully legible: no opacity dimming, chip ink intact.
describe('ActionRuleCell · locked chip', () => {
  it('is disabled, carries no opacity style and keeps the chipInk colour', () => {
    render(
      <ActionRuleCell effect="block" locked overridden={false} actionLabel="A" conditionLabel="C"
        selected={false} onCycle={() => {}} onSelectDetail={() => {}} />,
    )
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn.style.opacity).toBe('')
    // Reference element normalises the colour the same way the engine does.
    const ref = document.createElement('div')
    ref.style.color = chipInk('var(--color-danger)')
    expect(btn.style.color).toBe(ref.style.color)
  })
})
