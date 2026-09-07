/**
 * ReportDrawerChrome — the stacking level is a prop: a drawer opened from inside a
 * modal (assist results, workflow history) must render ABOVE that modal, the default
 * stays the house drawer band.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import ReportDrawerChrome from './ReportDrawerChrome'

describe('ReportDrawerChrome · stacking level', () => {
  it('uses the house drawer band by default', () => {
    const { container } = render(<ReportDrawerChrome title="Run" onClose={vi.fn()}><span>body</span></ReportDrawerChrome>)
    const layered = [...container.querySelectorAll('div')].filter(d => d.style.zIndex)
    expect(layered.length).toBeGreaterThan(0)
    expect(layered.every(d => d.style.zIndex === 'var(--z-drawer)')).toBe(true)
  })

  it('takes the caller level when the drawer opens above a modal', () => {
    const { container } = render(<ReportDrawerChrome title="Run" onClose={vi.fn()} zIndex={60}><span>body</span></ReportDrawerChrome>)
    const layered = [...container.querySelectorAll('div')].filter(d => d.style.zIndex)
    expect(layered.every(d => d.style.zIndex === '60')).toBe(true)
  })
})
