/**
 * useReferenceRelations — tenant-configurable relation lookup for a candidate's
 * third-party REFERENCES (REFERENTIE-VELDEN-1). Feeds candidate_references.relation_id.
 *
 * UNLIKE gender/nationality/work-permit-type (which validate the lookup's `value`
 * SLUG), the backend validates this one BY ROW ID —
 * `Rule::exists('reference_relations', 'id')`, CandidateReferenceController::rules()
 * — verified live against the CMBE contract (commit 9a9bd8c9). Mirrors
 * useEmergencyContactRelations exactly (same reasoning: a tenant renaming a
 * relation must never orphan an already-stored reference row) rather than
 * useWorkPermitTypes' value-based shape. Callers must send the option's `id`,
 * never its `value` slug or `label`.
 *
 * DELIBERATELY a separate lookup from emergency_contact_relations — professional
 * vocabulary towards a REFERENT (manager/collega/klant/opdrachtgever/docent/…),
 * not personal vocabulary towards a next-of-kin (ReferenceRelationController's
 * own file header).
 *
 * Fed by the API (GET /reference-relations → {id,value,label,color,sort_order,
 * active,in_use}) with a Dutch-market default as fallback while the API is
 * empty/unavailable — mirrors useEmergencyContactRelations/useWorkPermitTypes (CFG-1).
 * The fallback below mirrors the backend's own CandidateLookupSeeder defaults
 * exactly (value/label/color); its `id` is a synthetic placeholder (never a real
 * server row id) — a save attempted while genuinely offline/empty would correctly
 * 422, the same limitation every fallback-backed lookup in this codebase already
 * carries. Managed in Settings → Kandidaten → Referentie-relaties.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import type { LookupOption } from '@/types/common'
import { unwrapList } from '@/lib/api'

// A lookup option with its row `id` typed as a real string (not the base
// interface's catch-all `unknown`) — every caller needs `id` for the save path.
export interface ReferenceRelationOption extends LookupOption {
  id: string
}

// Seed DATA mirroring CandidateLookupSeeder::run() (koiosmatch-api) 1:1 — not a
// UI styling choice, hence the ad-hoc hex (CLAUDE.md §4 DATA exemption). `id`
// here is a synthetic placeholder (see file header), never a real server row id.
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
export const DEFAULT_REFERENCE_RELATIONS: ReferenceRelationOption[] = [
  { id: 'manager',       value: 'manager',       label: 'Manager',       color: '#6E8FD6' },
  { id: 'collega',       value: 'collega',       label: 'Collega',       color: '#5FB0AC' },
  { id: 'klant',         value: 'klant',         label: 'Klant',         color: '#DDA071' },
  { id: 'opdrachtgever', value: 'opdrachtgever', label: 'Opdrachtgever', color: '#8C86D9' },
  { id: 'docent',        value: 'docent',        label: 'Docent',       color: '#C98BBA' },
  { id: 'anders',        value: 'anders',        label: 'Anders',        color: '#94A3B8' },
]
/* eslint-enable no-restricted-syntax */

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapReferenceRelations = (res: AxiosResponse): ReferenceRelationOption[] | null => {
  const d = ((unwrapList(res).rows) as ReferenceRelationOption[]).filter(Boolean)
  return d.length ? d : null
}

export function useReferenceRelations() {
  const { data: referenceRelations } = useCachedLookup(
    '/reference-relations', mapReferenceRelations, DEFAULT_REFERENCE_RELATIONS,
  )
  return { referenceRelations }
}
