/**
 * sessionWindow — pure math for Meta's 24h WhatsApp customer-service window
 * (WA-WINDOW-1, Danny point 12: "als het venster niet open is, hoe stuur ik dan
 * een bericht?" — "if the window isn't open, how do I send a message then?").
 * The screen must SAY what is possible instead of hiding the
 * composer without a reason, so the window state is computed once, here, and
 * both the composer and the template fallback read the same answer.
 *
 * MEASURED against the live API (08-08, tenant yesway): GET /conversations
 * returns `last_inbound_at` (ISO8601, ConversationResource) and nothing else
 * about the window — there is no `window_expires_at`, no `can_send_freeform`,
 * no `session_open`. `last_inbound_at` IS the anchor the backend itself gates
 * on (WhatsAppBundleSender::sessionWindowOpen — `last_inbound_at > now()-24h`,
 * read-only verified in koiosmatch-api), so deriving the same rule from the
 * same field is mirroring the server, never inventing a second truth.
 *
 * The `known` flag exists for the one case we must NOT guess: a payload that
 * carries no `last_inbound_at` key at all (or an unparseable value). Then the
 * UI says so honestly instead of rendering a countdown it cannot back up.
 */

// Meta's free-form window: 24h since the candidate's LAST INBOUND message.
export const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000

// What the UI needs to decide between "free text" and "template only".
export interface SessionWindowState {
  /** False only when the payload gives us no usable anchor — never guess a clock. */
  known: boolean
  open: boolean
  /** Milliseconds left inside the window (0 once closed / unknown). */
  msLeft: number
  /** ISO moment the window closes, for an exact "closes at …" line; null when unknown. */
  expiresAt: string | null
}

// Derive the window state from the thread's own `last_inbound_at`.
export function sessionWindow(lastInboundAt: string | null | undefined, now: number = Date.now()): SessionWindowState {
  // Key absent from the payload → genuinely unknown (an older/partial API shape).
  if (lastInboundAt === undefined) return { known: false, open: false, msLeft: 0, expiresAt: null }
  // Present but empty → known and closed: no inbound message ever opened a window.
  if (lastInboundAt === null || lastInboundAt === '') return { known: true, open: false, msLeft: 0, expiresAt: null }
  const startedAt = new Date(lastInboundAt).getTime()
  // An unparseable timestamp is not a closed window — it is an unknown one.
  if (Number.isNaN(startedAt)) return { known: false, open: false, msLeft: 0, expiresAt: null }
  const expiresMs = startedAt + SESSION_WINDOW_MS
  const msLeft = expiresMs - now
  return { known: true, open: msLeft > 0, msLeft: Math.max(msLeft, 0), expiresAt: new Date(expiresMs).toISOString() }
}

// Split the remaining time into whole hours + minutes for ICU interpolation
// (never a concatenated "5u 12m" string — §5).
export function windowLeftParts(msLeft: number): { hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.floor(msLeft / 60_000))
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}
