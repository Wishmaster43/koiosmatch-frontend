// The Koios candidate columns HelloFlex receives outbound (BE CandidateFieldMap::ROWS with direction
// out/both, HF-ENTITY-SYNC-1a); the three create-only rows (date_of_birth, place_of_birth, created_at)
// are not patchable and stay out. Option values render through workflows:fieldOptions.<column>.
export const HELLOFLEX_OUTBOUND_CANDIDATE_COLUMNS = [
  'first_name',
  'last_name',
  'middle_name',
  'initials',
  'email',
  'phone',
  'mobile',
  'street',
  'house_number',
  'house_number_suffix',
  'postcode',
  'city',
] as const

// The Koios customer-contact columns HelloFlex receives outbound (BE ContactFieldMap::ROWS, every row travels
// `both`, HF-ENTITY-SYNC-1a; HF-WORKFLOWS-1 reads them for helloflex_contact_update, direction out only).
export const HELLOFLEX_OUTBOUND_CONTACT_COLUMNS = [
  'last_name',
  'first_name',
  'middle_name',
  'function',
  'email',
  'mobile',
  'phone',
] as const
