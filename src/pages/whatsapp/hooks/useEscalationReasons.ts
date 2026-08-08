/**
 * useEscalationReasons — tenant-configurable WhatsApp escalation-reason lookup
 * (LOOKUP-GAP-1(c)). Fed by GET /escalation-reasons ({id,name,color,sort_order,
 * in_use} rows, editable in Settings → WhatsApp → Escalatieredenen) with a seed
 * fallback mirroring the backend's own MessagingLookupSeeder defaults, used while
 * the API is empty/unavailable — same useCachedLookup convention as
 * useOutreachOutcomes/useNationalities (one GET per session, shared across every
 * mounted consumer).
 *
 * KNOWN BACKEND GAP (verified against koiosmatch-api, 2026-08-08): GET
 * /whatsapp/escalations (WhatsappDashboardController::escalations) still returns
 * a DERIVED diagnostic string ('failed_delivery' | 'no_reply' | 'negative_response'
 * from deriveEscalationReason()) on every row, never the conversation's real
 * escalation_reason_id — that column exists on the Conversation model/resource
 * but the dashboard endpoint never resolves/returns it. So metaOf() below already
 * resolves a REAL tenant reason (by id or name) correctly, but today's feed never
 * sends one; see ../components.tsx's DERIVED_REASON_STYLE for the honest fallback
 * that keeps today's three diagnostic keys colour-coded until that backend gap
 * closes. Flagged for CMBE, not fixed here (frontend-only task, backend read-only).
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from '@/lib/useCachedLookup'
import { unwrapList } from '@/lib/api'
import type { LookupOption } from '@/types/common'

// Seed mirrors MessagingLookupSeeder's own defaults 1:1 (name + hex) — DATA, not
// UI copy, same convention as DEFAULT_NATIONALITIES/DEFAULT_OUTREACH_OUTCOMES.
/* eslint-disable no-restricted-syntax -- DATA: seed mirrors the backend's own EscalationReason seeder hex values, not UI element styling */
export const DEFAULT_ESCALATION_REASONS: LookupOption[] = [
  { value: 'Ziek', label: 'Ziek', color: '#D98A8A' },
  { value: 'Boos', label: 'Boos', color: '#DC2626' },
  { value: 'Uitschrijven', label: 'Uitschrijven', color: '#6FA8C4' },
  { value: 'Overlijden', label: 'Overlijden', color: '#6B7280' },
  { value: 'Ongeluk', label: 'Ongeluk', color: '#DDA071' },
  { value: 'Overig', label: 'Overig', color: '#94A3B8' },
]
/* eslint-enable no-restricted-syntax */

// Normalise an API row (id/name/color) to the shared LookupOption shape — value
// is the row id (EscalationReasonController is a plain SimpleLookupController,
// no separate slug/value field), label the tenant-typed name.
const toOption = (r: Record<string, unknown>): LookupOption => ({
  value: String(r.id ?? r.name ?? ''),
  label: String(r.name ?? r.id ?? ''),
  color: (r.color as string) ?? undefined,
})

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapEscalationReasons = (res: AxiosResponse): LookupOption[] | null => {
  const rows = (unwrapList(res).rows) as Record<string, unknown>[]
  return Array.isArray(rows) && rows.length ? rows.map(toOption) : null
}

export function useEscalationReasons() {
  const { data: reasons, loading } = useCachedLookup('/escalation-reasons', mapEscalationReasons, DEFAULT_ESCALATION_REASONS)

  // Resolve a stored id/name to its meta (label + colour) — tolerant of either,
  // mirrors useOutreachOutcomes.metaOf. Undefined when nothing matches (the
  // caller decides the fallback — see the backend-gap note above).
  const metaOf = (v?: string | null): LookupOption | undefined =>
    reasons.find(o => o.value === v || o.label === v)

  return { reasons, loading, metaOf }
}
