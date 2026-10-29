// changelogScrub — pure helpers for the K004-AUDIT-SCRUB-1 marker: a candidate/contact
// erasure replaces `attribute_changes`/`properties` on an activity row with
// `{ scrubbed: true, reason: 'avg_erasure_request' }` (AuditTrailScrubber). These
// helpers let any activity-feed renderer (EntityChangelogTab, AuditDrawer) detect
// that marker without re-reading the Spatie diff shape itself.
import type { ChangelogEvent } from './EntityChangelogTab'

// True when a diff bag is the scrub marker, not a normal { attributes, old } bag.
export function isScrubbedActivity(bag: unknown): boolean {
  return !!bag && typeof bag === 'object' && !Array.isArray(bag) && (bag as { scrubbed?: unknown }).scrubbed === true
}

// Reads the scrub marker off an event's changes first, then properties — the same
// precedence as changesOf() in EntityChangelogTab, so both read one bag.
export function scrubbedBagOf(ev: ChangelogEvent): unknown {
  const bag = ev.changes ?? ev.properties
  return isScrubbedActivity(bag) ? bag : undefined
}

// Which i18n key renders the neutral line — the AVG-erasure reason gets its own
// wording, anything else (future scrub reasons) falls back to the generic key.
export function scrubReasonKey(reason: unknown): 'common:changelogScrubbedErasure' | 'common:changelogScrubbed' {
  return reason === 'avg_erasure_request' ? 'common:changelogScrubbedErasure' : 'common:changelogScrubbed'
}
