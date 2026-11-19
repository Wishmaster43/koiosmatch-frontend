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
