/**
 * Regression pins for the chip's ONE non-negotiable behaviour (Opus adres-ronde:
 * an icon-only refactor silently shrank the hit area at ~25 call sites): the
 * WHOLE chip — number text included — is the copy button.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/i18n'
import ReferenceNumberChip from './ReferenceNumberChip'

const writeText = vi.fn(() => Promise.resolve())
beforeEach(() => {
  writeText.mockClear()
  Object.assign(navigator, { clipboard: { writeText } })
})

describe('ReferenceNumberChip', () => {
  it('renders nothing without a value', () => {
    const { container } = render(<ReferenceNumberChip value={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('clicking the NUMBER TEXT itself copies — the whole chip is the button', async () => {
    render(<ReferenceNumberChip value="K-00123" />)
    fireEvent.click(screen.getByText('K-00123'))
    expect(writeText).toHaveBeenCalledWith('K-00123')
    expect(screen.getByRole('button', { name: 'Kopieer nummer' })).toBeInTheDocument()
  })
})
