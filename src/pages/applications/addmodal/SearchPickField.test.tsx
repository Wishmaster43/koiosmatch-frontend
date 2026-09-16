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

// HUISSTIJL-1: the search-error retry action is the shared Button atom, never a
// hand-styled <button> — clicking it calls onRetry.
describe('SearchPickField · search-error retry', () => {
  it('renders the retry action as a real button and calls onRetry when clicked', async () => {
    const onRetry = vi.fn()
    const user = (await import('@testing-library/user-event')).default.setup()
    render(<SearchPickField label="Vacancy" placeholder="Pick a vacancy" value={null} options={[]}
      onPick={vi.fn()} onSearch={vi.fn()} onRetry={onRetry} searchError="network" />)
    const retryBtn = screen.getByRole('button', { name: /error\.retry|retry/i })
    await user.click(retryBtn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
