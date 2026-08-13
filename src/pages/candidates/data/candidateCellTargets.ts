// Pure, React-free rules that decide WHICH drawer tab/sub-tab a candidate table
// cell deep-links to. Kept flag-driven (never slug/label matching) so a tenant
// renaming a lookup value never breaks navigation — see CLAUDE.md §3B.

export const TARGET_NOTES = 'communication:notes'
export const TARGET_CONVERSATIONS = 'communication:conversations'
export const TARGET_APPLICATIONS = 'work:applications'
export const TARGET_MATCHES = 'work:matches'
export const TARGET_POOLS = 'work:pools'
export const TARGET_PREFERENCES = 'preferences'
// KOPPELING-COLUMN-1: the backoffice-coupling column deep-links to the drawer's
// Koppelingen (Integraties) tab — a plain top-level tab id, no sub-tab needed.
export const TARGET_INTEGRATIONS = 'integrations'

/**
 * Contact-moment cell target. The last-contact-type lookup has no boolean flag
 * for "this channel is a chat thread" — WhatsApp is therefore detected by a
 * documented slug substring (the one permitted exception in this file); every
 * other channel (phone, email, appointment, note, …) opens Notities.
 */
export function contactTarget(lastContactType?: string | null): string {
  const slug = (lastContactType ?? '').toLowerCase()
  return slug.includes('whatsapp') ? TARGET_CONVERSATIONS : TARGET_NOTES
}

/**
 * Funnel-stage cell target. Driven by the `is_match` flag on the funnel-stage
 * lookup row (seed: Aangenomen), never by its label or slug — a renamed stage
 * must keep routing correctly.
 */
export function funnelTarget(stage?: { is_match?: boolean } | null): string {
  return stage?.is_match ? TARGET_MATCHES : TARGET_APPLICATIONS
}

/**
 * Deployability-status cell target. `requires_match` (seed: Geplaatst) opens the
 * Matches sub-tab; any of requires_reason/expects_return_date/is_blacklist (seed:
 * Ziek, Verlof, Niet beschikbaar, Blacklist) opens Voorkeuren, where the status
 * window and its edit pencil live. No flag set (seed: Beschikbaar) → no deep
 * link, so the plain row click stays in charge.
 */
export function statusTarget(
  status?: { requires_match?: boolean; requires_reason?: boolean; expects_return_date?: boolean; is_blacklist?: boolean } | null,
): string | null {
  if (!status) return null
  if (status.requires_match) return TARGET_MATCHES
  if (status.requires_reason || status.expects_return_date || status.is_blacklist) return TARGET_PREFERENCES
  return null
}
