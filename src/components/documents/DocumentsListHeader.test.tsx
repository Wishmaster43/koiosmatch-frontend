import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Namespace-aware key echo: a label resolves only when the component binds to the namespace that carries it (common).
const useTranslationMock = vi.fn((ns?: string) => ({ t: (k: string) => `${ns ?? 'default'}:${k}` }))
vi.mock('react-i18next', () => ({ useTranslation: (ns?: string) => useTranslationMock(ns) }))
import DocumentsListHeader from './DocumentsListHeader'

// Render helper with sensible defaults.
function setup(over: Partial<React.ComponentProps<typeof DocumentsListHeader>> = {}) {
  const onToggleAll = vi.fn()
  render(<DocumentsListHeader gridTemplateColumns="24px 1fr 1fr 1fr" selectAllLabel="all" allSelected={false}
    indeterminate={false} onToggleAll={onToggleAll} {...over} />)
  return { onToggleAll, box: screen.getByRole('checkbox', { name: 'all' }) as HTMLInputElement }
}

describe('DocumentsListHeader', () => {
  it('renders the three labels and the labelled checkbox', () => {
    setup()
    expect(screen.getByText('common:documents.name')).toBeTruthy()
    expect(screen.getByText('common:documents.type')).toBeTruthy()
    expect(screen.getByText('common:documents.size')).toBeTruthy()
  })
  it('checked follows allSelected', () => {
    expect(setup({ allSelected: true }).box.checked).toBe(true)
  })
  it('indeterminate DOM property follows the prop', () => {
    expect(setup({ indeterminate: true }).box.indeterminate).toBe(true)
  })
  it('calls onToggleAll once on click', () => {
    const { box, onToggleAll } = setup()
    fireEvent.click(box)
    expect(onToggleAll).toHaveBeenCalledTimes(1)
  })
})
