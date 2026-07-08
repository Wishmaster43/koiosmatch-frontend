/**
 * candidateStatusInfo — pure helpers extracted from CandidateDrawer (§0.3 split):
 * the human-readable status detail line and the phase required-field completeness
 * check. No state, no side effects — just computation, so they're unit-testable
 * and keep the drawer container focused on wiring.
 */
import { getJsonSetting } from '@/lib/settings/useAllSettings'
import type { Candidate } from '@/types/candidate'
import type { LookupOption } from '@/types/common'

// The status lookup row with its behaviour flags (§3B — flag-driven, never slug).
export type StatusFlags = (LookupOption & { requires_reason?: boolean; expects_return_date?: boolean; is_blacklist?: boolean }) | undefined

// Build the "Verlof sinds … · reden · weer beschikbaar …"-line for the current status.
// Flag-driven: blacklist shows its reason; requires_reason/expects_return_date shows
// reason + the "available again" date. Empty until the backend sends the audit fields.
export function buildStatusInfoLine({ c, statusFlags, currentStatus, statusMeta, t, formatDate }: {
  c: Candidate
  statusFlags: StatusFlags
  currentStatus: string
  statusMeta: (v?: string | null) => { label: string }
  t: (k: string, o?: Record<string, unknown>) => string
  formatDate: (s: string) => string
}): string | null {
  const st = currentStatus
  if (!st || !statusFlags) return null
  // "By whom" the status was set — shows once the backend returns status_changed_by (H2).
  const byWho = c.statusChangedBy ? t('drawer.byWho', { name: c.statusChangedBy }) : null
  if (statusFlags.is_blacklist && (c.blacklistReason || c.statusChangedAt)) {
    return [
      c.statusChangedAt ? t('drawer.statusSince', { status: statusMeta(st).label, date: formatDate(c.statusChangedAt) }) : t('drawer.blacklisted'),
      c.blacklistReason,
      byWho,
    ].filter(Boolean).join(' · ')
  }
  if ((statusFlags.requires_reason || statusFlags.expects_return_date) && (c.statusReason || c.statusReturnDate || c.statusChangedAt)) {
    return [
      c.statusChangedAt ? t('drawer.statusSince', { status: statusMeta(st).label, date: formatDate(c.statusChangedAt) }) : statusMeta(st).label,
      c.statusReason,
      c.statusReturnDate ? t('drawer.availableAgain', { date: formatDate(c.statusReturnDate) }) : null,
      byWho,
    ].filter(Boolean).join(' · ')
  }
  return null
}

// Phase required-field completeness (Settings → Verplichte velden) mapped to candidate
// fields → returns a predicate: is this phase's required set already filled in?
export function makeRequiredComplete(c: Candidate, allSettings: Parameters<typeof getJsonSetting>[0]) {
  const REQ_GET: Record<string, () => unknown> = {
    first_name: () => c.name, last_name: () => c.name, email: () => c.email, phone: () => c.phone,
    function_title: () => c.title, date_of_birth: () => c.dob, gender: () => c.gender,
    street: () => c.street, postal_code: () => c.postalCode, city: () => c.city,
  }
  return (phaseVal: string): boolean => {
    const cfg = getJsonSetting<Record<string, string[]>>(allSettings, 'candidate_required_fields',
      { lead: ['first_name', 'last_name'], candidate: ['first_name', 'last_name', 'email', 'phone', 'function_title'] })
    return (cfg[phaseVal] ?? []).every(k => { const g = REQ_GET[k]; return g ? String(g() ?? '').trim() !== '' : true })
  }
}
