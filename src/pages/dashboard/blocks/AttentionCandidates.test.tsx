/**
 * AttentionCandidates — the backend feed shape is { total, rows } per group
 * (not a bare array). Asserts: the shape renders, the "see all" link appears
 * only when total exceeds the sample size and carries the right candidates-page
 * attention intent, a zero-total group self-hides, and dates render DD-MM-YYYY.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { LookupsProvider } from '@/context/LookupsContext'
import AttentionCandidates from './AttentionCandidates'

// Shared wrapper: the block reads statusMeta from LookupsContext and labels
// through the `dashboard` i18n namespace.
function renderBlock(props: Partial<Parameters<typeof AttentionCandidates>[0]>) {
  return render(
    <I18nextProvider i18n={i18n}>
      <LookupsProvider>
        <AttentionCandidates {...props} />
      </LookupsProvider>
    </I18nextProvider>,
  )
}

describe('AttentionCandidates · { total, rows } shape', () => {
  it('renders the sampled rows of a group', () => {
    renderBlock({ groups: { stale6m: { total: 2, rows: [{ id: 1, name: 'Jan Jansen', last_contact_at: '2026-02-01' }, { id: 2, name: 'Marie Bakker' }] } } })
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByText('Marie Bakker')).toBeInTheDocument()
  })

  it('shows a "see all" link only when total exceeds the rows shown, with the right intent', () => {
    const onNavigate = vi.fn()
    renderBlock({
      groups: { never_contacted: { total: 12, rows: [{ id: 1, name: 'Piet' }] } },
      onNavigate,
    })
    const link = screen.getByText(/alle 12|all 12/i)
    fireEvent.click(link)
    expect(onNavigate).toHaveBeenCalledWith('candidates', { attention: 'neverContacted' })
  })

  it('shows no "see all" link when total equals the rows shown', () => {
    renderBlock({ groups: { no_followup: { total: 1, rows: [{ id: 1, name: 'Piet' }] } } })
    expect(screen.queryByText(/alle|see all/i)).not.toBeInTheDocument()
  })

  it('a zero-total group hides itself; a whole-block zero total renders nothing', () => {
    const { container } = renderBlock({ groups: { stale6m: { total: 0, rows: [] } } })
    expect(container).toBeEmptyDOMElement()
  })

  it('renders last_contact_at as DD-MM-YYYY', () => {
    renderBlock({ groups: { stale6m: { total: 1, rows: [{ id: 1, name: 'Jan Jansen', last_contact_at: '2026-02-05' }] } } })
    expect(screen.getByText('05-02-2026')).toBeInTheDocument()
  })
})
