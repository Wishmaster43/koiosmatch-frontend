import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PendingUploadFrame, PendingUploadRows, PendingUploadRow } from './PendingUploadFrame'

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
