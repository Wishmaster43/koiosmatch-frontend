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

// Reads the scrub marker off an event's properties first, then changes — mirrors the
// changesOf()/buildH2ChangelogLine() precedence already used for this same payload.
export function scrubbedBagOf(ev: ChangelogEvent): unknown {
  const bag = ev.properties ?? ev.changes
  return isScrubbedActivity(bag) ? bag : undefined
}

// Which i18n key renders the neutral line — the AVG-erasure reason gets its own
// wording, anything else (future scrub reasons) falls back to the generic key.
export function scrubReasonKey(reason: unknown): 'changelog.scrubbedErasure' | 'changelog.scrubbed' {
  return reason === 'avg_erasure_request' ? 'changelog.scrubbedErasure' : 'changelog.scrubbed'
}
