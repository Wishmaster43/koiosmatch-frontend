/**
 * interviewStatus — shared helpers for rendering an AI-interview session status
 * value. `current_status` (e.g. "ACTIVE_IN_CARE") is one entry off THAT flow's
 * own `statuses[]` list (interview_flows.statuses, verified live against
 * InterviewSessionResource::block for S-00001/Zorgintake: a 12-name,
 * tenant/flow-authored vocabulary), never a fixed global enum — so a static
 * i18n map per value would both violate "nothing hardcoded" (§3B) and miss
 * every future flow-defined name. SCREAMING_SNAKE → "Screaming snake" is the
 * honest fallback so the raw enum never reaches the screen; `translateInterviewStatus`
 * still tries a real i18n key first for the few markers the ENGINE ITSELF sets
 * verbatim (INTRO_SENT at session-create, COMPLETED/DISQUALIFIED at
 * session-end — InterviewEngine.php), which are the one part of this
 * vocabulary that IS universal.
 *
 * Moved out of InterviewStatusCard (I3, 08-08 raw-enum finding) so every
 * render site — the applications drawer, the strip, the AI-agent's read-only
 * interview-flow summary — shares ONE lookup instead of a copy each.
 */
import type { TFunction } from 'i18next'

// SCREAMING_SNAKE → "Screaming snake" — the never-crash, never-raw fallback
// for a tenant/flow-authored status this app has no fixed key for.
export function humanizeInterviewStatus(raw: string): string {
  const spaced = raw.replace(/_+/g, ' ').trim().toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * translateInterviewStatus — the i18n-first lookup every interview/session
 * status render site must use instead of showing the raw enum: tries the
 * shared `applications:interview.currentStatus.<raw>` key family first, then
 * falls back to the humanized raw value. The `ns` option (not a `ns:key`
 * string prefix) explicitly targets the `applications` namespace regardless
 * of which namespace the caller's own `t` is scoped to, so a caller like
 * InterviewFlowSection (scoped to `workflows`) still resolves the same
 * shared key family instead of duplicating it.
 */
export function translateInterviewStatus(t: TFunction, raw: string): string {
  return t(`interview.currentStatus.${raw}`, { ns: 'applications', defaultValue: humanizeInterviewStatus(raw) })
}
