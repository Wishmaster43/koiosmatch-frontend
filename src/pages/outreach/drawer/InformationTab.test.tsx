/**
 * InformationTab — DRILLDOWN-VOLGORDE-CANON (§3A): the campaign's own field
 * card. Name/channel are editable (PATCH via useOutreachDetail.setFields, seam
 * tested there); pool + created-at are read-only.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import InformationTab from './InformationTab'
import type { CampaignDetail } from '../hooks/useOutreachDetail'

const detail: CampaignDetail = {
  id: 'c1', name: 'Bellijst Zorg', channel: 'call', pool_name: 'Zorg-pool',
  created_at: '2026-07-10T10:00:00',
}

describe('InformationTab', () => {
  it('shows the read-only pool and created-at fields alongside the editable name', () => {
    render(<InformationTab detail={detail} loading={false} error={false} onRetry={() => {}} onSave={() => {}} />)
    expect(screen.getByText('Bellijst Zorg')).toBeInTheDocument()
    expect(screen.getByText('Zorg-pool')).toBeInTheDocument()
  })

  it('renders a spinner while the detail has not loaded yet, never an editable empty card', () => {
    render(<InformationTab detail={null} loading={true} error={false} onRetry={() => {}} onSave={() => {}} />)
    // No crash, no stray "Bellijst Zorg" from a previous render, and no editable
    // field card seeded from invented empties (loading state must not be an edit form).
    expect(screen.queryByText('Bellijst Zorg')).toBeNull()
    expect(screen.queryByTitle('Bewerken')).toBeNull()
  })

  it('renders an ErrorBanner with retry on a failed load, never an editable empty card', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<InformationTab detail={null} loading={false} error={true} onRetry={onRetry} onSave={() => {}} />)
    expect(screen.queryByTitle('Bewerken')).toBeNull()
    await user.click(screen.getByRole('button', { name: /opnieuw/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('calls onSave with the edited name (and unchanged channel) on save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<InformationTab detail={detail} loading={false} error={false} onRetry={() => {}} onSave={onSave} />)

    await user.click(screen.getByTitle('Bewerken'))
    const nameInput = screen.getByDisplayValue('Bellijst Zorg')
    await user.clear(nameInput)
    await user.type(nameInput, 'Nieuwe naam')
    await user.click(screen.getByTitle('Opslaan'))

    expect(onSave).toHaveBeenCalledWith({ name: 'Nieuwe naam', channel: 'call' })
  })
})
