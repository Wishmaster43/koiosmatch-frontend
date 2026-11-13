import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EventCatalog from './EventCatalog'

// ONIX G-002 (BE lane D f0855053): the live catalogue names the payload keys that leave per
// event (`fields`) and whether they carry personal data (`pii`); the picker shows both as
// hover text and the pii one as an icon with an accessible name — never colour-only.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: { fields?: string }) => (o?.fields ? `${k}:${o.fields}` : k), i18n: { exists: () => false } }) }))
vi.mock('./useWebhookEventCatalog', () => ({
  useWebhookEventCatalog: () => ({
    groups: [{ group: 'candidates', events: ['candidate.created', 'candidate.erased'] }],
    meta: { 'candidate.created': { pii: true, fields: ['id', 'status'] }, 'candidate.erased': { pii: false, fields: ['candidate_id'] } },
    isLoading: false, isFallback: false, events: [],
  }),
}))

describe('EventCatalog — per-event fields and pii caveats', () => {
  it('carries the fields allow-list as hover text and marks a pii event with a named icon', () => {
    render(<EventCatalog value={[]} onChange={() => {}} />)
    const row = screen.getByText('candidate.created').closest('div[title]')
    expect(row?.getAttribute('title')).toContain('webhooks.events.fieldsTitle:id, status')
    expect(row?.getAttribute('title')).toContain('webhooks.events.piiTitle')
    expect(screen.getByLabelText('webhooks.events.piiTitle')).toBeInTheDocument()
  })
  it('leaves a non-pii event without the icon but still names its fields', () => {
    render(<EventCatalog value={[]} onChange={() => {}} />)
    const row = screen.getByText('candidate.erased').closest('div[title]')
    expect(row?.getAttribute('title')).toBe('webhooks.events.fieldsTitle:candidate_id')
    expect(screen.getAllByLabelText('webhooks.events.piiTitle')).toHaveLength(1)
  })
})

// A11Y-CLICKABLE-1: the clickable label text is a keyboard-operable role=button (Enter and Space), not a bare span.
describe('EventCatalog - label keyboard operation', () => {
  it('toggles an event from its label with Enter and Space', () => {
    const onChange = vi.fn()
    render(<EventCatalog value={[]} onChange={onChange} />)
    // Unlisted action keys fall back to the raw key (open-ended server vocabulary), so the label text is the key.
    const eventLabel = screen.getByRole('button', { name: 'created' })
    fireEvent.keyDown(eventLabel, { key: 'Enter' })
    fireEvent.keyDown(eventLabel, { key: ' ' })
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange.mock.calls[0][0]).toContain('candidate.created')
  })
  it('toggles the whole group from the group label', () => {
    const onChange = vi.fn()
    render(<EventCatalog value={[]} onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'candidates' }), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['candidate.created', 'candidate.erased'])
  })
})
