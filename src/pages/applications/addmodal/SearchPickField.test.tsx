/**
 * SearchPickField — REQUIRED-A11Y-4: the trigger builds its OWN <button> via
 * SearchSelect's `renderTrigger` (see the file's own doc comment), so it never
 * inherits SearchSelect's internal aria-required handling — this test pins the
 * `ariaRequired` prop reaching that trigger directly, present and absent.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SearchPickField from './SearchPickField'

describe('SearchPickField · aria-required', () => {
  it('marks the trigger aria-required when ariaRequired is set', () => {
    render(<SearchPickField label="Vacancy" placeholder="Pick a vacancy" value={null} options={[]}
      onPick={vi.fn()} onSearch={vi.fn()} onRetry={vi.fn()} ariaRequired />)
    expect(screen.getByRole('button', { name: /Pick a vacancy/ })).toHaveAttribute('aria-required', 'true')
  })

  it('leaves aria-required off the trigger when ariaRequired is unset', () => {
    render(<SearchPickField label="Vacancy" placeholder="Pick a vacancy" value={null} options={[]}
      onPick={vi.fn()} onSearch={vi.fn()} onRetry={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Pick a vacancy/ })).not.toHaveAttribute('aria-required')
  })
})
