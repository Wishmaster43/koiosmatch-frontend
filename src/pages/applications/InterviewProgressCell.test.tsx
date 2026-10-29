import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InterviewProgressCell from './InterviewProgressCell'

// Key-echo i18n stub.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const interview = { category: 'in_progress', step: 2, total: 5 } as never

describe('InterviewProgressCell · keyboard', () => {
  it('is a tab stop that fires onClick once on Enter and Space without bubbling to the row', () => {
    const onClick = vi.fn()
    const rowClick = vi.fn()
    render(<div onClick={rowClick} onKeyDown={rowClick}><InterviewProgressCell interview={interview} onClick={onClick} /></div>)
    const cell = screen.getByRole('button')
    expect(cell).toHaveAttribute('tabindex', '0')
    fireEvent.keyDown(cell, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(cell, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(2)
    fireEvent.click(cell)
    expect(onClick).toHaveBeenCalledTimes(3)
    expect(rowClick).not.toHaveBeenCalled()
  })
  it('stays inert (no role, no tabindex) without onClick', () => {
    const { container } = render(<InterviewProgressCell interview={interview} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('[tabindex]')).toBeNull()
  })
})
