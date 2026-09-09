// Test the shared row frame container with selection and keyboard affordances.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchResultRowFrame from './SearchResultRowFrame'

describe('SearchResultRowFrame', () => {
  it('renders with selected styling when isSelected is true', () => {
    const { container } = render(
      <SearchResultRowFrame isSelected={true} onSelect={() => {}}>
        Test content
      </SearchResultRowFrame>
    )
    const frame = container.querySelector('[role="button"]')
    expect(frame).toHaveStyle('background: var(--color-primary-bg)')
  })

  it('renders with transparent background when isSelected is false', () => {
    const { container } = render(
      <SearchResultRowFrame isSelected={false} onSelect={() => {}}>
        Test content
      </SearchResultRowFrame>
    )
    const frame = container.querySelector('[role="button"]')
    expect(frame).toHaveStyle('background: transparent')
  })

  it('calls onSelect when clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { container } = render(
      <SearchResultRowFrame isSelected={false} onSelect={onSelect}>
        Test content
      </SearchResultRowFrame>
    )
    const frame = container.querySelector('[role="button"]')
    await user.click(frame!)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('calls onSelect when Enter key is pressed', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { container } = render(
      <SearchResultRowFrame isSelected={false} onSelect={onSelect}>
        Test content
      </SearchResultRowFrame>
    )
    const frame = container.querySelector('[role="button"]') as HTMLElement
    frame.focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('calls onSelect when Space key is pressed', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { container } = render(
      <SearchResultRowFrame isSelected={false} onSelect={onSelect}>
        Test content
      </SearchResultRowFrame>
    )
    const frame = container.querySelector('[role="button"]') as HTMLElement
    frame.focus()
    await user.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('renders children correctly', () => {
    render(
      <SearchResultRowFrame isSelected={false} onSelect={() => {}}>
        Test content
      </SearchResultRowFrame>
    )
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })
})
