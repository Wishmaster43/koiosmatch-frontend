/**
 * LocationBranchSection — regression test for the D9 tint finding: the
 * "own branches" state badge must use the shared lib/tint helpers (§4), not
 * an ad-hoc color-mix percentage that drifts from the 10/33 house pair.
 */
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import LocationBranchSection from './LocationBranchSection'
import { tintBg, tintBorder } from '@/lib/tint'
import '@/i18n'

describe('LocationBranchSection', () => {
  it('uses tintBg/tintBorder for the own-branches badge background and border', () => {
    const { container } = render(
      <LocationBranchSection
        branchIds={['1']}
        branches={[{ id: '1', name: 'Vestiging A' }]}
        inherited={false}
        effectiveBranches={[]}
        options={[{ value: '1', label: 'Vestiging A' }]}
        onChange={() => {}}
      />
    )
    const spans = Array.from(container.querySelectorAll('span'))
    const badge = spans.find(s => s.style.borderRadius === '99px')
    expect(badge).toBeTruthy()
    expect(badge!.style.background).toBe(tintBg('var(--color-primary)'))
    expect(badge!.style.border).toBe(tintBorder('var(--color-primary)'))
  })

  it('renders the inherited badge without any tint (muted, border-token colours)', () => {
    const { container } = render(
      <LocationBranchSection
        branchIds={[]}
        branches={[]}
        inherited
        effectiveBranches={[{ id: '1', name: 'Vestiging A' }]}
        options={[{ value: '1', label: 'Vestiging A' }]}
        onChange={() => {}}
      />
    )
    const spans = Array.from(container.querySelectorAll('span'))
    const badge = spans.find(s => s.style.borderRadius === '99px')
    expect(badge).toBeTruthy()
    expect(badge!.style.background).toBe('var(--bg)')
    expect(badge!.style.border).toBe('1px solid var(--border)')
  })
})
