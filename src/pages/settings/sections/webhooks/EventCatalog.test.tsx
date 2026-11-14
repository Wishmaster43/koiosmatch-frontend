import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EventCatalog from './EventCatalog'

// ONIX G-002 (BE lane D f0855053): the live catalogue names the payload keys that leave per
// event (`fields`) and whether they carry personal data (`pii`); the picker shows both as
// hover text and the pii one as an icon with an accessible name — never colour-only.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Echo the key, with the namespace when one is given and the fields when present.
    t: (k: string, o?: { fields?: string; ns?: string }) => (o?.fields ? `${k}:${o.fields}` : o?.ns ? `${o.ns}:${k}` : k),
    // Only trigger-event labels and the helloflex group label exist, so every other label keeps falling back to the raw value.
    i18n: { exists: (k: string) => k.startsWith('triggers.events.') || k === 'webhooks.events.groups.helloflex' },
  }),
}))
// The mocked catalogue is a variable so a describe can serve the HelloFlex groups.
const catalog = vi.hoisted(() => ({
  groups: [{ group: 'candidates', events: ['candidate.created', 'candidate.erased'] }] as { group: string; events: string[] }[],
  meta: { 'candidate.created': { pii: true, fields: ['id', 'status'] }, 'candidate.erased': { pii: false, fields: ['candidate_id'] } } as Record<string, { pii: boolean; fields: string[] }>,
}))
const defaultCatalog = { groups: catalog.groups, meta: catalog.meta }
vi.mock('./useWebhookEventCatalog', () => ({
  useWebhookEventCatalog: () => ({ groups: catalog.groups, meta: catalog.meta, isLoading: false, isFallback: false, events: [] }),
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

// HF-WEBHOOK-1: HelloFlex rows read the full trigger label, ids-only fields ride as hover text.
describe('EventCatalog - HelloFlex rows (HF-WEBHOOK-1)', () => {
  const HF_FIELDS = ['receipt_id', 'entity_guid', 'entity_type', 'entity_id']
  beforeEach(() => {
    catalog.groups = [
      { group: 'helloflex', events: ['helloflex.candidate.created', 'helloflex.employer.created'] },
      { group: 'matches', events: ['contract.signed'] },
    ]
    catalog.meta = {
      'helloflex.candidate.created': { pii: false, fields: HF_FIELDS },
      'helloflex.employer.created': { pii: false, fields: HF_FIELDS },
      'contract.signed': { pii: false, fields: ['match_id', 'candidate_id'] },
    }
  })
  afterEach(() => { catalog.groups = defaultCatalog.groups; catalog.meta = defaultCatalog.meta })

  it('renders distinct full labels per HelloFlex row as role=button and the helloflex group header', () => {
    render(<EventCatalog value={[]} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'workflows:triggers.events.helloflex_candidate_created' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'workflows:triggers.events.helloflex_employer_created' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'settings:webhooks.events.groups.helloflex' })).toBeInTheDocument()
  })
  it('keeps the action fallback for contract.signed and shows its raw key', () => {
    render(<EventCatalog value={[]} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'signed' })).toBeInTheDocument()
    expect(screen.getByText('contract.signed').tagName).toBe('CODE')
  })
  it('names the ids-only fields in the hover title of a HelloFlex row without a pii icon', () => {
    render(<EventCatalog value={[]} onChange={() => {}} />)
    const row = screen.getByText('helloflex.candidate.created').closest('div[title]')
    expect(row?.getAttribute('title')).toBe('webhooks.events.fieldsTitle:receipt_id, entity_guid, entity_type, entity_id')
    expect(screen.queryByLabelText('webhooks.events.piiTitle')).toBeNull()
  })
  // The search box matches the full HelloFlex label too, not only the raw key: a query that exists
  // only in the label (underscores, not dots) keeps the employer row and drops the other two.
  it('filters HelloFlex rows on their full label', () => {
    render(<EventCatalog value={[]} onChange={() => {}} />)
    fireEvent.change(screen.getByLabelText('webhooks.events.search'), { target: { value: 'triggers.events.helloflex_employer' } })
    expect(screen.getByText('helloflex.employer.created')).toBeInTheDocument()
    expect(screen.queryByText('helloflex.candidate.created')).toBeNull()
    expect(screen.queryByText('contract.signed')).toBeNull()
  })
})
