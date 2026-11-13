/**
 * IntegrationLinksTable — rows, deleted caption, status pills, inline edit save
 * and the read-only face without settings.update.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import IntegrationLinksTable from './IntegrationLinksTable'
import type { LinkRow } from './linksApi'

const t = (key: string) => i18n.t(key, { ns: 'settings' })

const row = (over: Partial<LinkRow>): LinkRow => ({
  entity_type: 'candidate', entity_id: 'c1', label: 'Ada Lovelace', system: 'helloflex', external_id: 'HF-1',
  status: 'linked', error: null, synced_at: null, linked_at: '2026-11-12T10:30:00Z', linked_by: 'u1', linked_by_name: 'Sara',
  updated_at: '2026-11-12T11:00:00Z', ...over,
})

describe('IntegrationLinksTable', () => {
  // Type label, record link to the drill-down, and the status pill render per row.
  it('renders the type label, a drill-down link and the status pill', () => {
    render(<IntegrationLinksTable rows={[row({}), row({ entity_id: 'c2', label: 'Bob', status: 'failed', error: 'boom' })]} loading={false} canEdit={false} onSave={vi.fn()} />)
    expect(screen.getAllByText(t('integrations.links.types.candidate'))).toHaveLength(2)
    // EntityLink: the name opens in-app, the icon link carries the deep link.
    expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: i18n.t('openInNewTab', { ns: 'common' }) })[0].getAttribute('href')).toContain('#candidates?open=c1')
    // The word also heads the linked column, so the pill is the second match.
    expect(screen.getAllByText(t('integrations.links.status.linked'))).toHaveLength(2)
    expect(screen.getByText(t('integrations.links.status.failed'))).toBeInTheDocument()
    expect(screen.getByText('boom')).toHaveAttribute('title', 'boom')
  })

  // A removed record shows the deleted caption and no link.
  it('shows the deleted caption for a removed record', () => {
    render(<IntegrationLinksTable rows={[row({ label: null })]} loading={false} canEdit={false} onSave={vi.fn()} />)
    expect(screen.getByText(t('integrations.links.deleted'))).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /./ })).not.toBeInTheDocument()
  })

  // Unlinked rows (status null) get the unlinked pill; types without a target stay plain text.
  it('shows the unlinked pill and plain text for a type without a drill-down', () => {
    render(<IntegrationLinksTable rows={[row({ entity_type: 'customer_location', label: 'Depot', status: null, external_id: null })]} loading={false} canEdit={false} onSave={vi.fn()} />)
    expect(screen.getByText(t('integrations.links.status.unlinked'))).toBeInTheDocument()
    expect(screen.getByText('Depot').closest('a')).toBeNull()
  })

  // Without settings.update the id is text, not an input.
  it('renders the external id read-only without edit permission', () => {
    render(<IntegrationLinksTable rows={[row({})]} loading={false} canEdit={false} onSave={vi.fn()} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('HF-1')).toBeInTheDocument()
  })

  // Editing enables the row save, which hands the trimmed id to onSave; clearing sends null.
  it('saves an edited id and clears with null', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<IntegrationLinksTable rows={[row({})]} loading={false} canEdit onSave={onSave} />)
    const input = screen.getByRole('textbox', { name: t('integrations.links.columns.externalId') })
    const save = screen.getByRole('button', { name: i18n.t('save', { ns: 'common' }) })
    expect(save).toHaveAttribute('aria-disabled', 'true')
    await userEvent.clear(input)
    await userEvent.type(input, ' HF-2 ')
    await userEvent.click(save)
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ entity_id: 'c1' }), 'HF-2'))
    await userEvent.clear(input)
    await userEvent.click(screen.getByRole('button', { name: i18n.t('save', { ns: 'common' }) }))
    await waitFor(() => expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ entity_id: 'c1' }), null))
  })

  // The empty state shows its caption.
  it('shows the empty text with no rows', () => {
    render(<IntegrationLinksTable rows={[]} loading={false} canEdit onSave={vi.fn()} />)
    expect(screen.getByText(t('integrations.links.empty'))).toBeInTheDocument()
  })
})
