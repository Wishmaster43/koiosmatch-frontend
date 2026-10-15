import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import EventCatalog from './EventCatalog'

// ONIX G-002 (BE lane D f0855053): the live catalogue names the payload keys that leave per
// event (`fields`) and whether they carry personal data (`pii`); the picker shows both as
// hover text and the pii one as an icon with an accessible name — never colour-only.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: { fields?: string; defaultValue?: string }) => (o?.fields ? `${k}:${o.fields}` : o?.defaultValue ?? k) }) }))
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
