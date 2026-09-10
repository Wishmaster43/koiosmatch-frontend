import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { pendingUploadTitle } from './pendingUploadTitle'

describe('pendingUploadTitle', () => {
  // A single queued file keeps the old name+size header.
  it('renders the name and size for one queued file', () => {
    render(<div>{pendingUploadTitle([{ name: 'a.pdf', size: '44 KB' }], 'ignored count label')}</div>)
    expect(screen.getByText('a.pdf')).toBeInTheDocument()
    expect(screen.getByText('(44 KB)')).toBeInTheDocument()
  })

  // A multi-file pick shows the caller's own resolved count label instead.
  it('renders the caller-resolved count label for multiple queued files', () => {
    render(
      <div>
        {pendingUploadTitle(
          [{ name: 'a.pdf', size: '44 KB' }, { name: 'b.pdf', size: '12 KB' }],
          '2 files queued',
        )}
      </div>,
    )
    expect(screen.getByText('2 files queued')).toBeInTheDocument()
    expect(screen.queryByText('a.pdf')).not.toBeInTheDocument()
  })
})
