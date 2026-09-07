/**
 * reportTableCells — test shared cell renderers (renderStatusCell, renderCountCell, renderMonospaceCell).
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { renderStatusCell, renderCountCell, renderMonospaceCell } from './reportTableCells'

describe('reportTableCells', () => {
  describe('renderStatusCell', () => {
    it('renders nothing when status is null', () => {
      const result = renderStatusCell(null)
      expect(result).toBeNull()
    })

    it('renders StatusBadge component when status is provided', () => {
      const { container } = render(<div>{renderStatusCell('active')}</div>)
      expect(container.textContent).not.toBe('')
    })
  })


  describe('renderCountCell', () => {
    it('renders 0 with — for zero count', () => {
      const { container } = render(<div>{renderCountCell(0)}</div>)
      expect(container.textContent).toContain('0')
      expect(container.textContent).toContain('—')
    })

    it('renders count without — for non-zero count', () => {
      const { container } = render(<div>{renderCountCell(5)}</div>)
      expect(container.textContent).toContain('5')
      expect(container.textContent).not.toContain('—')
    })

    it('handles undefined as zero', () => {
      const { container } = render(<div>{renderCountCell(undefined)}</div>)
      expect(container.textContent).toContain('0')
    })
  })

  describe('renderMonospaceCell', () => {
    it('renders — when value is null', () => {
      const { container } = render(<div>{renderMonospaceCell(null)}</div>)
      expect(container.textContent).toContain('—')
    })

    it('renders value in monospace font when provided', () => {
      const { container } = render(<div>{renderMonospaceCell('ABC123')}</div>)
      const span = container.querySelector('span[style*="monospace"]')
      expect(span?.textContent).toBe('ABC123')
    })
  })
})
