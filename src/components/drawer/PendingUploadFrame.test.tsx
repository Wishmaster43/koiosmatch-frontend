import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  PendingUploadFrame, PendingUploadRows, PendingUploadRow,
  PendingUploadTypeSelect, PendingUploadRemoveButton, PendingUploadFooter,
} from './PendingUploadFrame'

describe('PendingUploadFrame', () => {
  // The frame renders the caller-resolved title above its children — no i18n
  // of its own, so a plain string/JSX title passes through untouched.
  it('renders the resolved title above its children', () => {
    render(
      <PendingUploadFrame title="2 files queued">
        <div>chip row</div>
      </PendingUploadFrame>,
    )
    expect(screen.getByText('2 files queued')).toBeInTheDocument()
    expect(screen.getByText('chip row')).toBeInTheDocument()
  })
})

describe('PendingUploadRows', () => {
  it('renders its children inside the column wrapper', () => {
    const { container } = render(
      <PendingUploadRows>
        <div>row one</div>
        <div>row two</div>
      </PendingUploadRows>,
    )
    expect(screen.getByText('row one')).toBeInTheDocument()
    expect(screen.getByText('row two')).toBeInTheDocument()
    expect(container.firstChild).toHaveStyle({ display: 'flex', flexDirection: 'column' })
  })
})

describe('PendingUploadRow', () => {
  // Name and size render in the fixed order, followed by the caller's own
  // per-file controls (type select / link picker / remove button, …).
  it('renders name, size and the caller-supplied controls in order', () => {
    const { container } = render(
      <PendingUploadRow name="a.pdf" size="44 KB">
        <button>remove</button>
      </PendingUploadRow>,
    )
    expect(container.textContent).toBe('a.pdf44 KBremove')
    expect(screen.getByRole('button', { name: 'remove' })).toBeInTheDocument()
  })
})

describe('PendingUploadTypeSelect', () => {
  // The sr-only label carries the caller's own resolved text and id-links to
  // the SelectMenu trigger via aria-labelledby (SelectMenu's trigger is a
  // <button>, which ignores a plain <label for>).
  it('renders the resolved label linked to the select trigger', () => {
    const options = [{ value: 'cv', label: 'CV' }]
    render(
      <PendingUploadTypeSelect labelId="doc-0" label="Type for a.pdf" value="cv" onChange={vi.fn()} options={options} />,
    )
    expect(screen.getByText('Type for a.pdf')).toHaveAttribute('id', 'doc-0')
    // SelectMenu appends its own trigger id to the labelledby list — assert the
    // sr-only label id is part of it, not the whole attribute value.
    const trigger = screen.getByText('CV').closest('button') as HTMLButtonElement
    expect(trigger.getAttribute('aria-labelledby')?.split(' ')).toContain('doc-0')
  })
})

describe('PendingUploadRemoveButton', () => {
  // Clicking the glyph fires the caller's onClick; the accessible name comes
  // from the caller-supplied ariaLabel, never a hardcoded string.
  it('fires onClick and carries the caller-supplied aria-label', () => {
    const onClick = vi.fn()
    render(<PendingUploadRemoveButton onClick={onClick} ariaLabel="Remove a.pdf" />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove a.pdf' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('PendingUploadFooter', () => {
  // The add/cancel actions fire the caller's own handlers; both labels render
  // as passed in (rule C: resolved by the consumer's own t()).
  it('renders the resolved labels and wires add/cancel', () => {
    const onAdd = vi.fn()
    const onCancel = vi.fn()
    render(<PendingUploadFooter addLabel="Add all (3)" cancelLabel="Cancel" onAdd={onAdd} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Add all (3)'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
