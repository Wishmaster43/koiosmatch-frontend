/**
 * requiredFieldsCatalog (candidate) — the full set of candidate fields a tenant may
 * declare required per phase, grouped the way the candidate screens already group them
 * (Persoonlijk · Contact · Adres · Werk · Overig). Mirrors the customer catalog's shape
 * (sections/customers/requiredFieldsCatalog.ts) so both required-fields editors read the
 * same way, with ONE difference: the candidate backend has NO whitelist — the guard
 * (`App\Services\Candidate\RequiredFieldsGuard`) simply reads the tenant setting and
 * checks `optional($candidate)->{$field}`. So the limit is ours, and this file IS the
 * limit: it must list every field a recruiter can actually fill in, and nothing else.
 *
 * `labelKey` is a fully-qualified `namespace:path` key REUSED from where that same field
 * is already labelled today (create modal / drawer / profile) — this screen never mints a
 * second translated copy of e.g. "Mobiel".
 *
 * ── Inclusion rule (measured against the live API, 2026-08-09) ──────────────────────
 * A field is listed only when all three hold, because the guard's check is
 * `optional($existing)->{$field}` against a submitted-or-current value:
 *   1. it is a readable Candidate model attribute (else the check reads NULL forever and
 *      the tenant locks itself out of every save),
 *   2. it is writable through `CandidateProfileRequest` (a fillable column without a
 *      validation rule is silently dropped by validate() — same bug class the backend
 *      already fixed for `nationality` and `linkedin_slug`),
 *   3. it has a real, unconditional input somewhere in the candidate UI.
 * Anything failing one of those would be a fake affordance (§3) — a switch that either
 * does nothing or can never be satisfied. See EXCLUDED_SYSTEM_FIELDS below.
 *
 * ── Key names are the COLUMN keys, not the response keys ───────────────────────────
 * The guard reads the MODEL (`optional($existing)->{$field}`), so the setting must carry
 * the column name — and for two fields the API response does NOT match the column.
 * Measured 2026-08-09: `create_candidates_table` defines `postcode` and `linkedin_slug`,
 * while `GET /candidates/{id}` returns them as `postal_code` and `linkedin`. Storing the
 * response name would read as NULL forever and block every save for that phase, so the
 * previous screen's `postal_code` / `linkedin` entries are folded onto the column names
 * by LEGACY_FIELD_KEY_ALIASES rather than silently left in place.
 */

/** One toggleable candidate field: the backend key + an existing i18n label key. */
export interface CandidateRequiredFieldDef {
  /** Candidate model attribute AND CandidateProfileRequest write key. */
  key: string
  /** Existing i18n key (`ns:path`) this field is already labelled with elsewhere. */
  labelKey: string
}

/** A collapsible block of related fields, titled with an existing i18n key. */
export interface CandidateRequiredFieldGroup {
  id: string
  titleKey: string
  fields: CandidateRequiredFieldDef[]
}

// The catalog, grouped exactly like the candidate create modal's cards so a recruiter
// recognises the blocks. Every key verified readable + writable against the live API.
export const CANDIDATE_FIELD_GROUPS: CandidateRequiredFieldGroup[] = [
  {
    id: 'personal',
    titleKey: 'candidates:modal.fields.cardPersonal',
    fields: [
      { key: 'first_name', labelKey: 'candidates:modal.fields.firstName' },
      { key: 'middle_name', labelKey: 'candidates:modal.fields.middleName' },
      { key: 'last_name', labelKey: 'candidates:modal.fields.lastName' },
      { key: 'date_of_birth', labelKey: 'candidates:modal.fields.dob' },
      // `place_of_birth` is deliberately absent — see EXCLUDED_SYSTEM_FIELDS (measured
      // unwritable: the tenant PATCH drops it, so requiring it would block every create).
      { key: 'gender', labelKey: 'candidates:modal.fields.gender' },
      { key: 'nationality', labelKey: 'candidates:modal.fields.nationality' },
    ],
  },
  {
    id: 'contact',
    titleKey: 'candidates:modal.fields.cardContact',
    fields: [
      { key: 'email', labelKey: 'candidates:modal.fields.email' },
      { key: 'phone', labelKey: 'candidates:modal.fields.phone' },
      // Danny 09-08: "ik mis heel veel velden zoals mobiel" — mobile is its own
      // validated column on CandidateProfileRequest, distinct from the landline.
      { key: 'mobile', labelKey: 'candidates:modal.fields.mobile' },
      { key: 'linkedin_slug', labelKey: 'candidates:modal.fields.linkedin' },
    ],
  },
  {
    id: 'address',
    titleKey: 'candidates:modal.fields.cardAddress',
    fields: [
      { key: 'street', labelKey: 'candidates:modal.fields.street' },
      { key: 'house_number', labelKey: 'candidates:modal.fields.houseNumber' },
      { key: 'house_number_suffix', labelKey: 'candidates:modal.fields.houseNumberSuffix' },
      { key: 'postcode', labelKey: 'candidates:modal.fields.postalCode' },
      { key: 'city', labelKey: 'candidates:modal.fields.city' },
      { key: 'province', labelKey: 'candidates:modal.fields.province' },
      { key: 'country', labelKey: 'candidates:modal.fields.country' },
    ],
  },
  {
    id: 'work',
    titleKey: 'candidates:modal.fields.cardWork',
    fields: [
      { key: 'function_title', labelKey: 'candidates:modal.fields.functionTitle' },
      { key: 'status', labelKey: 'candidates:drawer.deployability' },
      { key: 'owner_id', labelKey: 'candidates:modal.fields.owner' },
      // The bureau branch: the column is `location_id`; the list resource exposes it
      // as `branch_id`, which is NOT a model attribute (measured: NULL) — so the
      // setting must carry `location_id`.
      { key: 'location_id', labelKey: 'candidates:filters.branch' },
      { key: 'work_permit_type', labelKey: 'candidates:profile.workPermitType' },
      { key: 'work_permit_valid_until', labelKey: 'candidates:profile.workPermitValidUntil' },
      { key: 'desired_rate_min', labelKey: 'candidates:preferences.desiredRateMin' },
      { key: 'desired_rate_max', labelKey: 'candidates:preferences.desiredRateMax' },
    ],
  },
  {
    id: 'other',
    titleKey: 'candidates:preferences.groupOther',
    fields: [
      { key: 'source', labelKey: 'candidates:filters.source' },
      { key: 'summary', labelKey: 'candidates:modal.fields.summary' },
    ],
  },
]

/** Every catalog key, flat — used for the legacy-key sweep and by the tests. */
export const CANDIDATE_FIELD_KEYS: string[] = CANDIDATE_FIELD_GROUPS.flatMap(g => g.fields.map(f => f.key))

/**
 * Keys an older version of this screen wrote that the guard can NEVER satisfy, mapped
 * onto the model attribute they meant. Folding them keeps the tenant's intent ("postcode
 * was required") while removing a switch that silently blocks every save.
 */
export const LEGACY_FIELD_KEY_ALIASES: Record<string, string> = {
  postal_code: 'postcode',
  linkedin: 'linkedin_slug',
}

/**
 * Fields deliberately NOT offered, with the reason. Exported so the catalog test can
 * assert none of them leaked in — a required-toggle on any of these is a fake affordance
 * (§3): nobody can fill it, so it either does nothing or blocks saving forever.
 *
 *  · System-set / derived — no input exists and the value is computed or stamped:
 *    id, reference_number, name, address, created_at, deleted_at, deleted_by, archived,
 *    archive_reason, lifecycle, pending_erase_at, retention_expires_at, lat, lng,
 *    distance_km, photo_url, koios_advice, integrity_violations, missing_appointment,
 *    has_planned_appointment, next_appointment_at, status_changed_at, status_changed_by,
 *    phase_changed_at, last_contact_at, last_contact_type, last_contact_by,
 *    funnel_type, funnel_label, funnel_color (the funnel lives on the APPLICATION —
 *    there is no candidate column), branch_id (response alias of location_id).
 *  · Not writable — fillable on the model but carrying NO CandidateProfileRequest rule,
 *    so validate() drops the value and it can never be set through the app. Requiring
 *    one would make every CREATE unsatisfiable (a new candidate has no current value to
 *    fall back on): `place_of_birth` — PROVEN live 2026-08-09, one PATCH carrying both
 *    `mobile` and `place_of_birth` wrote the mobile and left the birthplace untouched.
 *    Also `initials`. `facebook_leads_id` does have a rule but no input (webhook-stamped),
 *    and `cv_parse_token` is a one-shot create token, not a stored field.
 *  · Circular — `phase` is the axis that SELECTS the required set and the guard defaults
 *    it to 'lead' when empty, so the toggle can never fire.
 *  · Conditional on another flow — only reachable inside the status-change modal, so
 *    requiring them phase-wide is unsatisfiable for a normal candidate; they already have
 *    their own enforcement (`requires_reason` on the status lookup, blacklist_reason_required):
 *    status_reason, blacklist_reason, available_again_date.
 *  · Not scalar — the guard's blank test is `=== []`, which an Eloquent Collection or a
 *    nested blob never matches, so the toggle would be silently dead:
 *    candidate_types, pools, tags, branches/location_ids, consent, preferences.*,
 *    freelance.*, planning_settings, custom_fields (custom fields have their own block,
 *    which writes to the DEFINITION — see CandidateCustomRequiredFields).
 */
export const EXCLUDED_SYSTEM_FIELDS: string[] = [
  'id', 'reference_number', 'name', 'address', 'created_at', 'deleted_at', 'deleted_by',
  'archived', 'archive_reason', 'lifecycle', 'pending_erase_at', 'retention_expires_at',
  'lat', 'lng', 'distance_km', 'photo_url', 'koios_advice', 'integrity_violations',
  'missing_appointment', 'has_planned_appointment', 'next_appointment_at',
  'status_changed_at', 'status_changed_by', 'phase_changed_at',
  'last_contact_at', 'last_contact_type', 'last_contact_by',
  'funnel_type', 'funnel_label', 'funnel_color', 'branch_id',
  'initials', 'place_of_birth', 'facebook_leads_id', 'cv_parse_token', 'phase',
  'status_reason', 'blacklist_reason', 'available_again_date',
  'candidate_types', 'pools', 'tags', 'branches', 'location_ids', 'consent',
  'preferences', 'freelance', 'planning_settings', 'custom_fields',
]

/**
 * Rewrites a stored required-field list onto keys the guard can actually read: legacy
 * aliases are folded onto their real key and duplicates collapse. Unknown keys are kept
 * as-is — a key this catalog does not know may still be a valid attribute a future
 * release adds, and dropping it would silently relax a tenant's enforcement.
 */
export function normalizeRequiredFieldKeys(keys: readonly string[]): string[] {
  const out: string[] = []
  for (const k of keys) {
    const mapped = LEGACY_FIELD_KEY_ALIASES[k] ?? k
    if (!out.includes(mapped)) out.push(mapped)
  }
  return out
}
