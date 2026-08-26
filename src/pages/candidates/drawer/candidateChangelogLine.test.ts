// candidateChangelogLine — unit tests for the extracted pure H2 line-builder
// (§11 LANE-B round 2: split out of ChangelogTab.tsx to trim its line count).
import { describe, it, expect } from 'vitest'
import { buildH2ChangelogLine, type H2Props } from './candidateChangelogLine'
import type { ChangelogEvent, ChangelogDiffBag } from '@/components/drawer/tabs/EntityChangelogTab'

// Stub lookup resolvers + a stub translator that echoes the key (with interpolation),
// exactly enough to assert the builder's own composition logic.
const statusMeta = (v: string) => ({ label: `Status:${v}` })
const phaseMeta = (v: string) => ({ label: `Phase:${v}` })
const t = (key: string, opts?: Record<string, unknown>) => (opts?.date ? `${key}(${opts.date})` : key)
const formatDate = (iso: string) => `fmt(${iso})`

describe('buildH2ChangelogLine', () => {
  it('returns null when the event carries no H2 payload', () => {
    const ev: ChangelogEvent = { changes: { attributes: { first_name: 'X' } } }
    expect(buildH2ChangelogLine(ev, { statusMeta, phaseMeta }, t, formatDate)).toBeNull()
  })

  it('builds a status-axis transition line from → to', () => {
    const props: H2Props = { axis: 'status', from: 'available', to: 'placed' }
    const ev: ChangelogEvent = { properties: props as unknown as ChangelogDiffBag }
    const result = buildH2ChangelogLine(ev, { statusMeta, phaseMeta }, t, formatDate)
    expect(result).toEqual({ field: 'changelog.fields.status', line: 'Status:available → Status:placed' })
  })

  it('resolves the phase axis against phaseMeta, not statusMeta', () => {
    const props: H2Props = { axis: 'phase', from: 'lead', to: 'candidate' }
    const ev: ChangelogEvent = { changes: props as unknown as ChangelogDiffBag }
    const result = buildH2ChangelogLine(ev, { statusMeta, phaseMeta }, t, formatDate)
    expect(result?.line).toBe('Phase:lead → Phase:candidate')
  })

  it('appends blacklist reason, reason-given and date extras when present', () => {
    const props: H2Props = {
      axis: 'status', from: 'available', to: 'blacklist', blacklist_reason: 'no-show',
      reason_given: true, available_again_date: '2026-09-01', effective_from: '2026-08-20',
    }
    const ev: ChangelogEvent = { properties: props as unknown as ChangelogDiffBag }
    const result = buildH2ChangelogLine(ev, { statusMeta, phaseMeta }, t, formatDate)
    expect(result?.line).toBe(
      'Status:available → Status:blacklist · no-show · changelog.reasonGiven · drawer.availableAgain(fmt(2026-09-01)) · changelog.effectiveFrom(fmt(2026-08-20))',
    )
  })

  it('renders an empty-from as the emptyValue translation, not "undefined"', () => {
    const props: H2Props = { axis: 'status', to: 'available' }
    const ev: ChangelogEvent = { properties: props as unknown as ChangelogDiffBag }
    const result = buildH2ChangelogLine(ev, { statusMeta, phaseMeta }, t, formatDate)
    expect(result?.line).toBe('changelog.emptyValue → Status:available')
  })
})
