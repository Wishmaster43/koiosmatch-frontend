import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DocTypeChipRow from './DocTypeChipRow'

const options = [
  { value: 'cv', label: 'CV' },
  { value: 'diploma', label: 'Diploma' },
]

describe('DocTypeChipRow', () => {
  // Clicking a chip fires onPick with that chip's own value, regardless of
  // which chip the caller currently marks active.
  it('fires onPick with the clicked chip value', () => {
    const onPick = vi.fn()
    render(<DocTypeChipRow options={options} isActive={v => v === 'cv'} onPick={onPick} />)
    fireEvent.click(screen.getByText('Diploma'))
    expect(onPick).toHaveBeenCalledWith('diploma')
  })

  // The caller's isActive resolver decides which chip renders as selected —
  // the row itself carries no notion of "active" beyond calling it per option.
  it('renders the caller-resolved active chip with bold weight', () => {
    render(<DocTypeChipRow options={options} isActive={v => v === 'diploma'} onPick={vi.fn()} />)
    expect(screen.getByText('CV')).toHaveStyle({ fontWeight: 400 })
    expect(screen.getByText('Diploma')).toHaveStyle({ fontWeight: 600 })
  })
})
