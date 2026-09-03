/**
 * EntityChangelogTab — regression test for the CHANGELOG-3 null-guard (§11 LANE-B):
 * a raw-uuid diff (owner/pool/agent references) must render as a neutral "updated"
 * line, never be silently dropped by a plain oldVal !== newVal filter and never
 * print the raw id at the user. Real i18n (nl) so `t()` resolves genuine copy.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/i18n'
import nlCandidates from '@/i18n/locales/nl/candidates.json'
import EntityChangelogTab, { type ChangelogEvent } from './EntityChangelogTab'

const uuidA = '11111111-2222-3333-4444-555555555555'
const uuidB = '99999999-2222-3333-4444-555555555555'

describe('EntityChangelogTab · CHANGELOG-3 uuid guard', () => {
  it('renders a card with the neutral "updated" line for a uuidA → uuidB diff, never the raw ids', async () => {
    const events: ChangelogEvent[] = [{
      id: 'e1', causer_name: 'Danny Polak', created_at: '2026-08-01T10:00:00Z', event: 'updated',
      changes: { attributes: { owner_id: uuidB }, old: { owner_id: uuidA } },
    }]
    render(<EntityChangelogTab items={events} loading={false} error={false} namespace="candidates" />)

    // The card survives (this is exactly the case a plain `oldVal !== newVal` filter
    // used to drop, since fmtVal nulls both sides and null === null looked "unchanged").
    expect(await screen.findByText(nlCandidates.changelog.updatedValue)).toBeInTheDocument()
    // Neither raw uuid is ever printed at the user.
    expect(screen.queryByText(uuidA)).not.toBeInTheDocument()
    expect(screen.queryByText(uuidB)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain(uuidA)
    expect(document.body.textContent).not.toContain(uuidB)
  })

  it('still renders a normal old → new row for a non-uuid field change', async () => {
    const events: ChangelogEvent[] = [{
      id: 'e2', causer_name: 'Danny Polak', created_at: '2026-08-01T10:00:00Z', event: 'updated',
      changes: { attributes: { first_name: 'Nieuwe naam' }, old: { first_name: 'Oude naam' } },
    }]
    render(<EntityChangelogTab items={events} loading={false} error={false} namespace="candidates" />)
    expect(await screen.findByText('Oude naam')).toBeInTheDocument()
    expect(screen.getByText('Nieuwe naam')).toBeInTheDocument()
  })

  it('shows the empty state when there are no items', () => {
    render(<EntityChangelogTab items={[]} loading={false} error={false} namespace="candidates" />)
    expect(screen.getByText(nlCandidates.changelog.empty)).toBeInTheDocument()
  })

  it('shows the loading state while loading', () => {
    render(<EntityChangelogTab items={[]} loading error={false} namespace="candidates" />)
    expect(screen.getByText(nlCandidates.changelog.loading)).toBeInTheDocument()
  })

  it('shows the error state on error, not the empty state', () => {
    render(<EntityChangelogTab items={[]} loading={false} error namespace="candidates" />)
    expect(screen.getByText(nlCandidates.changelog.error)).toBeInTheDocument()
    expect(screen.queryByText(nlCandidates.changelog.empty)).not.toBeInTheDocument()
  })

  // K-ACTLOG-ROLLUP-1: a mixed feed's `subjectLabel` renders as a real §4 soft chip
  // (SoftChip), never a plain bold span — and stays visible next to its diff row.
  it('renders the sub-entity label as a soft chip when `subjectLabel` is given', async () => {
    const events: ChangelogEvent[] = [{
      id: 'e3', causer_name: 'Danny Polak', created_at: '2026-08-01T10:00:00Z', event: 'updated',
      subject_type: 'CustomerLocation',
      changes: { attributes: { street: 'Nieuwe straat' }, old: { street: 'Oude straat' } },
    }]
    render(
      <EntityChangelogTab
        items={events} loading={false} error={false} namespace="candidates"
        subjectLabel={ev => (ev.subject_type === 'CustomerLocation' ? 'Vestiging' : undefined)}
      />,
    )
    const chip = await screen.findByText('Vestiging')
    // SoftChip's own tinted background — proves it went through the shared
    // chip component rather than a hand-rolled <span style={{fontWeight:600}}>.
    expect(chip.closest('span')).toHaveStyle({ borderRadius: '99px' })
  })

  // K-ACTLOG-SUBJECT-NAME-1: subject_id (already on the wire, LogsEntityActivity)
  // reaches the caller's subjectLabel so it can resolve WHICH sub-entity, not
  // only its type — this locks in the typed field on the wire contract.
  it('passes subject_id through to the subjectLabel callback', async () => {
    const events: ChangelogEvent[] = [{
      id: 'e4', causer_name: 'Danny Polak', created_at: '2026-08-01T10:00:00Z', event: 'updated',
      subject_type: 'CustomerLocation', subject_id: 9,
      changes: { attributes: { street: 'Nieuwe straat' }, old: { street: 'Oude straat' } },
    }]
    render(
      <EntityChangelogTab
        items={events} loading={false} error={false} namespace="candidates"
        subjectLabel={ev => (ev.subject_type === 'CustomerLocation' ? `Vestiging · ${ev.subject_id}` : undefined)}
      />,
    )
    expect(await screen.findByText('Vestiging · 9')).toBeInTheDocument()
  })

  // CHANGELOG-DESC-I18N-1: a diff-less entry's description reaches the reader through
  // describeChangelog — a key-shaped description (lookup.reordered) renders translated.
  it('renders a translated body line for a key-shaped fallback description', async () => {
    const events: ChangelogEvent[] = [{
      id: 'e5', causer_name: 'Danny Polak', created_at: '2026-08-01T10:00:00Z', event: 'updated',
      description: 'lookup.reordered',
    }]
    render(<EntityChangelogTab items={events} loading={false} error={false} namespace="candidates" fallbackDescription />)
    expect(await screen.findByText('Volgorde gewijzigd')).toBeInTheDocument()
    expect(screen.queryByText('lookup.reordered')).not.toBeInTheDocument()
  })

  // A legacy Dutch literal (not yet migrated to a key) keeps rendering as-is.
  it('renders a legacy literal fallback description unchanged', async () => {
    const events: ChangelogEvent[] = [{
      id: 'e6', causer_name: 'Danny Polak', created_at: '2026-08-01T10:00:00Z', event: 'updated',
      description: 'Dossier geopend',
    }]
    render(<EntityChangelogTab items={events} loading={false} error={false} namespace="candidates" fallbackDescription />)
    expect(await screen.findByText('Dossier geopend')).toBeInTheDocument()
  })
})
