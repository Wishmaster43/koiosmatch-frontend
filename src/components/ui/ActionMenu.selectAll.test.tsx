import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ActionMenu from './ActionMenu'
import type { MenuNode } from './ActionMenu'

// The bulk bar's multi-select level (contract form add/remove, pools, …) is a
// searchable checklist too — Danny punt 7 applies here as well.
const OPTIONS = [
  { value: 'zzp', label: 'ZZP' },
  { value: 'zzp-plus', label: 'ZZP Plus' },
  { value: 'payroll', label: 'Payroll' },
]

const multiNode = (onSubmit: (v: unknown) => void): MenuNode => ({
  key: 'types', label: 'Contractvorm', options: OPTIONS, multiSelect: true, selected: [], onSubmit,
})
const singleNode: MenuNode = { key: 'owner', label: 'Eigenaar', options: OPTIONS, onPick: () => {} }

const openLevel = (label: string) => {
  fireEvent.click(screen.getByRole('button', { name: /Acties/ }))
  fireEvent.click(screen.getByRole('menuitem', { name: label }))
}
const selectAllButton = () => screen.getByRole('menuitem', { name: /multiSelect\.(selectVisible|clearVisible)/ })

describe('ActionMenu · select all on a multi-select level', () => {
  it('ticks exactly the search hits and submits them', () => {
    const onSubmit = vi.fn()
    render(<ActionMenu label="Acties" items={[multiNode(onSubmit)]} />)
    openLevel('Contractvorm')
    fireEvent.change(screen.getByPlaceholderText('search'), { target: { value: 'zzp' } })

    expect(selectAllButton().textContent).toContain('2')
    fireEvent.click(selectAllButton())
    fireEvent.click(screen.getByRole('button', { name: /save/ }))
    expect(onSubmit).toHaveBeenCalledWith(['zzp', 'zzp-plus'])
  })

  it('clicking it again unticks exactly those, leaving the rest of the set alone', () => {
    const onSubmit = vi.fn()
    render(<ActionMenu label="Acties" items={[multiNode(onSubmit)]} />)
    openLevel('Contractvorm')
    // Tick Payroll by hand first, then select-all/clear-all the "zzp" hits.
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Payroll' }))
    fireEvent.change(screen.getByPlaceholderText('search'), { target: { value: 'zzp' } })
    fireEvent.click(selectAllButton())
    fireEvent.click(selectAllButton())
    fireEvent.change(screen.getByPlaceholderText('search'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save/ }))

    expect(onSubmit).toHaveBeenCalledWith(['payroll'])
  })

  it('is absent on a single-pick option level (§ punt 3)', () => {
    render(<ActionMenu label="Acties" items={[singleNode]} />)
    openLevel('Eigenaar')
    expect(screen.queryByRole('menuitem', { name: /multiSelect\./ })).not.toBeInTheDocument()
  })
})
