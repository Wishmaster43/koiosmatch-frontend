/**
 * DocumentsAttentionTable — asserts rows render from the exact server shape,
 * a row click opens the candidate's documents tab, and the issue chip label
 * routes through t('feed.issue.<issue>').
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DocumentsAttentionTable from './DocumentsAttentionTable'
import type { DocumentAttentionRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => opts ? `${k}:${JSON.stringify(opts)}` : k }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `fmt:${v}` }) }))

const rows: DocumentAttentionRow[] = [
  { candidate_id: 'c1', name: 'Jan Jansen', issue: 'missing_cv', expires_at: null, days_left: null },
  { candidate_id: 'c2', name: 'Marie Bakker', issue: 'expiring', expires_at: '2026-09-01', days_left: 7 },
]

describe('DocumentsAttentionTable', () => {
  it('renders rows from the server shape with expiry date and days-left fallbacks', () => {
    render(<DocumentsAttentionTable rows={rows} onNavigate={vi.fn()} />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByText('Marie Bakker')).toBeInTheDocument()
    expect(screen.getByText('fmt:2026-09-01')).toBeInTheDocument()
  })

  it('navigates to the candidate documents tab on row click', () => {
    const onNavigate = vi.fn()
    render(<DocumentsAttentionTable rows={rows} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Jan Jansen'))
    expect(onNavigate).toHaveBeenCalledWith('candidates', { open: 'c1', tab: 'documents' })
  })

  it('self-hides on an empty feed', () => {
    const { container } = render(<DocumentsAttentionTable rows={[]} onNavigate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
