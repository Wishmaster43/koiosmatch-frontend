/**
 * OutputTree — behaviour tests for the OUTPUT-TREE-TYPED-1 options (typed,
 * counts, bundles, expand-/collapse-all signals). Mocks react-i18next so `t()`
 * returns the raw key (mirrors canvas.test.tsx / configPanelRequired.test.tsx):
 * assertions read the raw i18n keys, never a Dutch literal.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OutputTree from './OutputTree'

// Real i18n is not initialized here; `t()` returns the raw key so assertions
// stay language-neutral and never leak a Dutch literal into the test file.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'nl' } }),
}))

const fixture = { name: 'x', items: [{ a: 1 }, { a: 2 }], flag: true, nothing: null, n: 3, obj: { a: 1 } }

describe('OutputTree — default render (byte-identical, every option off)', () => {
  it('shows no glyph, no field-count caption and no bundle label', () => {
    render(<OutputTree data={fixture} searchable={false} />)
    expect(screen.queryByText('T')).toBeNull()
    expect(screen.queryByText('{ }')).toBeNull()
    expect(screen.queryByText('[ ]')).toBeNull()
    expect(screen.queryByText('inspector.fieldCount')).toBeNull()
    expect(screen.queryByText('inspector.bundle')).toBeNull()
    expect(screen.getByText('name:')).toBeTruthy()
  })
})

describe('OutputTree — typed', () => {
  it('renders the glyph per value type and the italic empty word for null', () => {
    render(<OutputTree data={fixture} searchable={false} typed />)
    expect(screen.getByText('T')).toBeTruthy() // name: text
    expect(screen.getByText('[ ]')).toBeTruthy() // items: array branch
    expect(screen.getAllByText('{ }').length).toBeGreaterThanOrEqual(1) // obj: object branch
    expect(screen.getByText('✓')).toBeTruthy() // flag: true
    expect(screen.getByText('#')).toBeTruthy() // n: number
    expect(screen.getByText('∅')).toBeTruthy() // nothing: null glyph
    expect(screen.getByText('inspector.empty')).toBeTruthy() // nothing: null
  })
})

describe('OutputTree — counts', () => {
  it('shows the field-count caption on a branch', () => {
    render(<OutputTree data={fixture} searchable={false} counts />)
    expect(screen.getAllByText('inspector.fieldCount').length).toBeGreaterThanOrEqual(1)
  })
  it('shows nothing extra on an empty object (no branch rendered for it)', () => {
    render(<OutputTree data={{ nested: {} }} searchable={false} counts />)
    expect(screen.queryByText('inspector.fieldCount')).toBeNull()
  })
})

describe('OutputTree — bundles', () => {
  it('opens bundle 1 and keeps the rest collapsed, with position/total rows', () => {
    // A top-level bundle array skips the outer (closed-by-default) array branch —
    // Children renders the bundle rows directly, as the run-step inspector gets them.
    const data = [{ a: 1 }, { a: 2 }, { a: 3 }]
    render(<OutputTree data={data} searchable={false} bundles />)
    expect(screen.getAllByText('inspector.bundle')).toHaveLength(3)
    // Bundle 1 is open: its own field "a" is visible exactly once; Bundles 2/3 stay collapsed.
    expect(screen.getAllByText('a:')).toHaveLength(1)
    expect(screen.getAllByText(/inspector\.bundlePosition/)).toHaveLength(1)
    expect(screen.getAllByText(/inspector\.bundleTotal/)).toHaveLength(1)
    // Opening Bundle 2 doubles up both the field and the position/total rows.
    fireEvent.click(screen.getAllByText('inspector.bundle')[1])
    expect(screen.getAllByText('a:')).toHaveLength(2)
    expect(screen.getAllByText(/inspector\.bundlePosition/)).toHaveLength(2)
    expect(screen.getAllByText(/inspector\.bundleTotal/)).toHaveLength(2)
  })
  it('uses bundleTotal over array length when given', () => {
    const data = [{ a: 1 }, { a: 2 }]
    render(<OutputTree data={data} searchable={false} bundles bundleTotal={50} />)
    expect(screen.getAllByText(/inspector\.bundleTotal/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('50')).toBeTruthy()
  })
  it('reads a nested bundle array\'s own <key>_total sibling, not the root bundleTotal prop', () => {
    const data = { rows: [{ a: 1 }, { a: 2 }], rows_total: 250 }
    render(<OutputTree data={data} searchable={false} bundles />)
    // Opening the "rows" branch reveals Bundle 1, open by default, showing total 250.
    fireEvent.click(screen.getByText('rows'))
    expect(screen.getByText('250')).toBeTruthy()
  })
})

describe('OutputTree — expand-/collapse-all signals', () => {
  it('opens a closed branch when expandSignal bumps, closes it when collapseSignal bumps', () => {
    const data = { group: { a: 1, b: 2 } }
    const { rerender } = render(<OutputTree data={data} searchable={false} />)
    expect(screen.queryByText('a:')).toBeNull() // collapsed by default
    rerender(<OutputTree data={data} searchable={false} expandSignal={1} />)
    expect(screen.getByText('a:')).toBeTruthy()
    rerender(<OutputTree data={data} searchable={false} expandSignal={1} collapseSignal={1} />)
    expect(screen.queryByText('a:')).toBeNull()
  })
  it('does not re-fire on mount when a signal is already set (REFS-IN-EFFECTS-1)', () => {
    // Bundle 1's defaultOpen=true must survive mounting with both signals already at 0.
    const data = [{ a: 1 }, { a: 2 }]
    const { rerender } = render(<OutputTree data={data} searchable={false} bundles expandSignal={0} collapseSignal={0} />)
    expect(screen.getByText('a:')).toBeTruthy() // Bundle 1 stays open
    rerender(<OutputTree data={data} searchable={false} bundles expandSignal={0} collapseSignal={1} />)
    expect(screen.queryByText('a:')).toBeNull() // collapseSignal bump closes it
  })
})

describe('OutputTree — search still narrows with options on', () => {
  it('filters rows by query while typed/counts/bundles are active', () => {
    const data = { alpha: 'one', beta: 'two' }
    render(<OutputTree data={data} typed counts />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'alpha' } })
    expect(screen.getByText('alpha:')).toBeTruthy()
    expect(screen.queryByText('beta:')).toBeNull()
  })
})
