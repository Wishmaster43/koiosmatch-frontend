// Shared candidate-lookup pieces: the per-type flag fields (a superset — only
// the flags matching the active block's type are ever populated) and the
// label→slug suggestion, used by both CandidateLookupsSettings (the list) and
// CandidateLookupItemModal (the add/edit modal) so the two never drift apart.
export interface CandidateLookupFlags {
  requires_appointment?: boolean
  requires_reason?: boolean
  requires_match?: boolean
  expects_return_date?: boolean
  is_match?: boolean
  is_rejected?: boolean
  is_proposal?: boolean
  is_blacklist?: boolean
  is_applicant?: boolean
  customer_not_applicable?: boolean
  is_leave?: boolean
  is_unavailable?: boolean
  has_contract_lines?: boolean
}

// "Not active" → "not_active" — a stable English-ish slug suggestion.
export const slugify = (s: string): string => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
