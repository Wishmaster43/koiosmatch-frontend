import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ReportFilterSidebar from './ReportFilterSidebar'
import type { ReportFilterGroup } from '@/types/reports'

// i18n is not initialised in tests, so t() returns the raw key — assertions
// check for those keys (e.g. 'filters.expandAll'), same convention as the
// other reports tests in this folder.
//
// Every group here uses `type: 'checkbox'` (the sidebar's plain fallback body)
// so an option's label renders as inline text — not re-echoed on a dropdown
// trigger (SearchSelectGroup shows the single selected option's label on its
// own closed trigger, which would collide with the active-filter chip bar's
// text and make assertions ambiguous). Queries are scoped with `within` +
// `data-testid="filter-group-<key>"` to stay clear of that chip bar regardless.

// Six groups: enough to exercise the "first 4 open, rest closed" default
// (KANDIDAAT-100 punt 31b) and to keep 'title'/'pool' collapsed by default.
function makeGroups(): ReportFilterGroup[] {
  const tog = () => {}
  return [
    { key: 'status', label: 'Status', type: 'checkbox', selected: ['available'], options: [{ value: 'available', label: 'Available' }], onToggle: tog },
    { key: 'phase',  label: 'Phase',  type: 'checkbox', selected: [], options: [{ value: 'lead', label: 'Lead' }], onToggle: tog },
    { key: 'funnel', label: 'Funnel', type: 'checkbox', selected: [], options: [{ value: 'applied', label: 'Applied' }], onToggle: tog },
    { key: 'type',   label: 'Type',   type: 'checkbox', selected: [], options: [{ value: 'flex', label: 'Flex' }], onToggle: tog },
    { key: 'title',  label: 'Function', type: 'checkbox', selected: [], options: [{ value: 'nurse', label: 'Nurse' }], onToggle: tog },
    { key: 'pool',   label: 'Pool',   type: 'checkbox', selected: ['a'], options: [{ value: 'a', label: 'Pool A' }], onToggle: tog },
  ]
}

// The group's option text, if its body is currently rendered (null when collapsed).
function optionTextOf(groupKey: string, optionLabel: string): HTMLElement | null {
  const block = screen.getByTestId(`filter-group-${groupKey}`)
  return within(block).queryByText(optionLabel)
}

// The block's own chevron+label toggle button — named by its label, since an
// OPEN group with an active selection also renders a sibling "clear" button
// in the same block (a plain `getByRole('button')` would then be ambiguous).
function toggleButtonOf(groupKey: string, label: string): HTMLElement {
  const block = screen.getByTestId(`filter-group-${groupKey}`)
  return within(block).getByRole('button', { name: new RegExp(label) })
}

describe('ReportFilterSidebar — collapsible group blocks (punt 31)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('renders one block per group with its label always visible', () => {
    render(<ReportFilterSidebar groups={makeGroups()} onClose={() => {}} pageId="test-candidates" />)
    ;[['status', 'Status'], ['phase', 'Phase'], ['funnel', 'Funnel'], ['type', 'Type'], ['title', 'Function'], ['pool', 'Pool']]
      .forEach(([key, label]) => {
        expect(within(screen.getByTestId(`filter-group-${key}`)).getByText(label)).toBeInTheDocument()
      })
  })

  it('defaults the first 4 groups open (options visible) and the rest closed', () => {
    render(<ReportFilterSidebar groups={makeGroups()} onClose={() => {}} pageId="test-candidates" />)
    // Open by default: 'status' (index 0) shows its option.
    expect(optionTextOf('status', 'Available')).not.toBeNull()
    expect(optionTextOf('type', 'Flex')).not.toBeNull()
    // Closed by default: 'title'/'pool' (index 4/5) hide their option.
    expect(optionTextOf('title', 'Nurse')).toBeNull()
    expect(optionTextOf('pool', 'Pool A')).toBeNull()
  })

  it('shows the active-selection count chip on a collapsed group', () => {
    render(<ReportFilterSidebar groups={makeGroups()} onClose={() => {}} pageId="test-candidates" />)
    // 'pool' is collapsed by default and has 1 selected value → a "1" badge in its header.
    const header = toggleButtonOf('pool', 'Pool')
    expect(header.textContent).toContain('Pool')
    expect(header.textContent).toContain('1')
  })

  it('toggling a group header reveals/hides its body', () => {
    render(<ReportFilterSidebar groups={makeGroups()} onClose={() => {}} pageId="test-candidates" />)
    expect(optionTextOf('pool', 'Pool A')).toBeNull()

    fireEvent.click(toggleButtonOf('pool', 'Pool'))
    expect(optionTextOf('pool', 'Pool A')).not.toBeNull()

    fireEvent.click(toggleButtonOf('pool', 'Pool'))
    expect(optionTextOf('pool', 'Pool A')).toBeNull()
  })

  it('expand-all opens every group, collapse-all closes every group', () => {
    render(<ReportFilterSidebar groups={makeGroups()} onClose={() => {}} pageId="test-candidates" />)
    expect(optionTextOf('pool', 'Pool A')).toBeNull()

    fireEvent.click(screen.getByTitle('filters.expandAll'))
    expect(optionTextOf('pool', 'Pool A')).not.toBeNull()
    expect(optionTextOf('title', 'Nurse')).not.toBeNull()

    fireEvent.click(screen.getByTitle('filters.collapseAll'))
    expect(optionTextOf('pool', 'Pool A')).toBeNull()
    expect(optionTextOf('status', 'Available')).toBeNull()
  })

  it('persists collapse choices per page id across a remount ("reload")', () => {
    const { unmount } = render(<ReportFilterSidebar groups={makeGroups()} onClose={() => {}} pageId="test-persist" />)
    // Open the collapsed 'pool' group, then unmount (simulates navigating away / reloading).
    fireEvent.click(toggleButtonOf('pool', 'Pool'))
    expect(optionTextOf('pool', 'Pool A')).not.toBeNull()
    unmount()

    render(<ReportFilterSidebar groups={makeGroups()} onClose={() => {}} pageId="test-persist" />)
    expect(optionTextOf('pool', 'Pool A')).not.toBeNull()
  })

  it('keeps persistence isolated per page id', () => {
    const { unmount } = render(<ReportFilterSidebar groups={makeGroups()} onClose={() => {}} pageId="page-a" />)
    fireEvent.click(toggleButtonOf('pool', 'Pool'))
    expect(optionTextOf('pool', 'Pool A')).not.toBeNull()
    unmount()

    // A different page id starts from the same sensible default (closed).
    render(<ReportFilterSidebar groups={makeGroups()} onClose={() => {}} pageId="page-b" />)
    expect(optionTextOf('pool', 'Pool A')).toBeNull()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<ReportFilterSidebar groups={makeGroups()} onClose={onClose} pageId="test-candidates" />)
    // i18n isn't initialised in tests, so t('close') resolves to the raw key.
    fireEvent.click(screen.getByLabelText('close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
