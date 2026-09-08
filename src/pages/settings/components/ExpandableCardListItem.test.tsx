/**
 * ExpandableCardListItem.test — Unit tests for the shared expandable card
 * list item component with header, body, and footer.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpandableCardListItem from './ExpandableCardListItem'

describe('ExpandableCardListItem', () => {
  const mockOnToggle = vi.fn()
  const item = { id: 'test-item-1' }

  it('renders header content when closed', () => {
    render(
      <ExpandableCardListItem
        item={item}
        isOpen={false}
        onToggleOpen={mockOnToggle}
        headerContent={<div>Test Header</div>}
        children={<div>Body content</div>}
        footer={<div>Footer content</div>}
        ariaLabel="Toggle item"
      />
    )
    expect(screen.getByText('Test Header')).toBeInTheDocument()
  })

  it('does not render body when closed', () => {
    render(
      <ExpandableCardListItem
        item={item}
        isOpen={false}
        onToggleOpen={mockOnToggle}
        headerContent={<div>Test Header</div>}
        children={<div>Body content</div>}
        footer={<div>Footer content</div>}
        ariaLabel="Toggle item"
      />
    )
    expect(screen.queryByText('Body content')).not.toBeInTheDocument()
  })

  it('renders body and footer when open', () => {
    render(
      <ExpandableCardListItem
        item={item}
        isOpen={true}
        onToggleOpen={mockOnToggle}
        headerContent={<div>Test Header</div>}
        children={<div>Body content</div>}
        footer={<div>Footer content</div>}
        ariaLabel="Toggle item"
      />
    )
    expect(screen.getByText('Body content')).toBeInTheDocument()
    expect(screen.getByText('Footer content')).toBeInTheDocument()
  })

  it('calls onToggleOpen when chevron button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <ExpandableCardListItem
        item={item}
        isOpen={false}
        onToggleOpen={mockOnToggle}
        headerContent={<div>Test Header</div>}
        children={<div>Body content</div>}
        footer={<div>Footer content</div>}
        ariaLabel="Toggle item"
      />
    )

    const button = screen.getByRole('button')
    await user.click(button)
    expect(mockOnToggle).toHaveBeenCalledTimes(1)
  })

  it('sets aria-expanded attribute correctly', () => {
    const { rerender } = render(
      <ExpandableCardListItem
        item={item}
        isOpen={false}
        onToggleOpen={mockOnToggle}
        headerContent={<div>Test Header</div>}
        children={<div>Body content</div>}
        footer={<div>Footer content</div>}
        ariaLabel="Toggle item"
      />
    )

    let button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-expanded', 'false')

    rerender(
      <ExpandableCardListItem
        item={item}
        isOpen={true}
        onToggleOpen={mockOnToggle}
        headerContent={<div>Test Header</div>}
        children={<div>Body content</div>}
        footer={<div>Footer content</div>}
        ariaLabel="Toggle item"
      />
    )

    button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('renders ChevronUp when open and ChevronDown when closed', () => {
    const { container, rerender } = render(
      <ExpandableCardListItem
        item={item}
        isOpen={false}
        onToggleOpen={mockOnToggle}
        headerContent={<div>Test Header</div>}
        children={<div>Body content</div>}
        footer={<div>Footer content</div>}
        ariaLabel="Toggle item"
      />
    )

    // When closed, should show ChevronDown
    let chevron = container.querySelector('svg[class*="lucide"]')
    expect(chevron).toBeInTheDocument()

    rerender(
      <ExpandableCardListItem
        item={item}
        isOpen={true}
        onToggleOpen={mockOnToggle}
        headerContent={<div>Test Header</div>}
        children={<div>Body content</div>}
        footer={<div>Footer content</div>}
        ariaLabel="Toggle item"
      />
    )

    // When open, should show ChevronUp
    chevron = container.querySelector('svg[class*="lucide"]')
    expect(chevron).toBeInTheDocument()
  })
})
