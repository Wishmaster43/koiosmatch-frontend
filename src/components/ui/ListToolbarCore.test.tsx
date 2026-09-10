import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ListToolbarCore from './ListToolbarCore'

// ListToolbarCore — the add/search/clear trio shared by every list-page toolbar's
// idle state (candidates/customers/vacancies/opportunities/…). Guards the
// canCreate gate, the addContent pass-through and that every callback still
// reaches the right handler after the extraction (DRY round 11, BULKBARS).
const baseProps = () => ({
  canCreate: true,
  onAdd: vi.fn(),
  addContent: '+ Add',
  searchEpoch: 0,
  onSearch: vi.fn(),
  searchPlaceholder: 'Search…',
  anyFilterActive: false,
  onClearFilters: vi.fn(),
})

describe('ListToolbarCore', () => {
  it('renders the add button when canCreate is true', () => {
    render(<ListToolbarCore {...baseProps()} />)
    expect(screen.getByText('+ Add')).toBeInTheDocument()
  })

  it('hides the add button when canCreate is false (OPENERS-HIDE-1)', () => {
    render(<ListToolbarCore {...baseProps()} canCreate={false} />)
    expect(screen.queryByText('+ Add')).toBeNull()
  })

  it('fires onAdd when the add button is clicked', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<ListToolbarCore {...props} />)
    await user.click(screen.getByText('+ Add'))
    expect(props.onAdd).toHaveBeenCalledTimes(1)
  })

  it('renders the search box with the given placeholder', () => {
    render(<ListToolbarCore {...baseProps()} />)
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument()
  })

  it('renders an icon-based addContent node just as well as a plain string', () => {
    render(<ListToolbarCore {...baseProps()} addContent={<span data-testid="icon-add">Icon add</span>} />)
    expect(screen.getByTestId('icon-add')).toBeInTheDocument()
  })

  // R10-COMMON step 11: the shared trio pins its markup — the 300px search
  // frame and the epoch remount that clears a typed query — not only its callbacks.
  it('gives the search box its 300px frame and remounts it on a search-epoch bump', () => {
    const { rerender } = render(<ListToolbarCore {...baseProps()} searchEpoch={0} />)
    // The one page-toolbar md button (34px beside the 34px search chrome, §4).
    expect(screen.getByText('+ Add').closest('button')).toHaveStyle({ height: '34px' })
    const input = screen.getByPlaceholderText('Search…') as HTMLInputElement
    expect(input.closest('[style*="300px"]')).not.toBeNull()
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(input.value).toBe('abc')
    rerender(<ListToolbarCore {...baseProps()} searchEpoch={1} />)
    expect((screen.getByPlaceholderText('Search…') as HTMLInputElement).value).toBe('')
  })
})
