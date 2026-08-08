/**
 * workPermitVisibility — DANNY-PUNT-1 (2026-08-09): decides whether the candidate
 * drawer's work-permit card is rendered at all. Pure functions, no React, so the
 * rule itself is unit-testable without a network or a DOM.
 *
 * THE RULE: the card is visible unless we can PROVE it is pointless — i.e. the
 * candidate's nationality provably resolves to the company's OWN country and the
 * card is still empty. Every unknown (no nationality, no company country, lookup
 * not answered, nationality not resolvable, no country behind the lookup row)
 * keeps the card VISIBLE. Danny 09-08, verbatim: a wrongly hidden work permit is
 * worse than an always-visible block. Never invert this default.
 *
 * WHY A LOOKUP IS NEEDED AT ALL — measured live against koiosmatch-api (tenant
 * yesway, 09-08), because the two sides are NOT the same vocabulary:
 *   • GET /settings          → `company_country` = 'NL'          (ISO-2 CODE)
 *   • candidates.nationality → 'Nederlandse'                     (Dutch ADJECTIVE)
 * A direct string compare is therefore always false and would show the card for
 * every Dutch candidate at a Dutch company — exactly the noise being removed.
 * The bridge exists: GET /nationalities rows carry `country_code` ('Nederlands' →
 * 'NL') next to `is_eu`, so the adjective can be mapped onto an ISO-2 code and
 * compared like-for-like. That mapping is the ONLY reason this is buildable.
 *
 * THE NAME JOIN IS INFLECTION-TOLERANT, AND IT HAS TO BE. The lookup stores
 * 'Nederlands' while all 200 seeded candidates store 'Nederlandse' — a plain
 * equality join (which both the old FE hook and the backend's WorkPermitGuard
 * still use) resolves NOTHING, which is why the card looked unconditional. The
 * single trailing-'e' Dutch adjective inflection is accepted in both directions,
 * but only when it lands on exactly ONE lookup row; anything ambiguous stays
 * unresolved and the card stays visible. Verified against the live vocabulary:
 * zero rows collide under that rule.
 */

/** One row of GET /nationalities — only the three fields this rule reads. */
export interface NationalityRow {
  name?: string | null
  country_code?: string | null
  is_eu?: boolean | null
}

/**
 * Whether the card already holds residence-right data — deliberately THREE-valued.
 *
 * 'unobservable' is not defensive padding: mapCandidate.ts (the single mapper the
 * drawer's candidate goes through) drops both work-permit columns today, measured
 * 09-08 — none of `work_permit_type` / `workPermitType` / `work_permit_valid_until`
 * / `workPermitValidUntil` survives it, even though GET /candidates/{id} returns
 * the first and third. Collapsing that blind spot into 'empty' would let the card
 * hide a permit that genuinely exists on the server, which is the single failure
 * mode this whole change is required not to have. Only a provably EMPTY card may
 * ever be hidden; the rule starts hiding by itself once the mapper carries the fields.
 */
export type WorkPermitDataState = 'filled' | 'empty' | 'unobservable'

/** Everything the visibility rule needs, gathered by the hook that wraps it. */
export interface WorkPermitVisibilityInput {
  /** The candidate's stored nationality (a Dutch adjective, e.g. 'Nederlandse'). */
  nationality?: string | null
  /** The tenant's `company_country` setting (ISO-2, e.g. 'NL'). */
  companyCountry?: string | null
  /** Rows from GET /nationalities; empty while unresolved. */
  rows: NationalityRow[]
  /** Has the lookup actually answered? An empty array is not the same as "no answer". */
  lookupResolved: boolean
  /** Does the card already hold data — and can we even tell? */
  dataState: WorkPermitDataState
}

/** Case- and diacritic-insensitive comparison key ('Oekraïens' → 'oekraiens'). */
export function normalizeName(value?: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * Resolve a stored nationality string onto its lookup row — the only bridge from
 * a Dutch adjective to an ISO-2 country code. Returns null whenever the answer
 * would be a guess, which the caller treats as "keep the card visible".
 */
export function resolveNationalityRow(
  rows: NationalityRow[],
  nationality?: string | null,
): NationalityRow | null {
  const wanted = normalizeName(nationality)
  if (!wanted) return null

  // An exact name match wins outright; two rows sharing one name is ambiguous
  // tenant data, and guessing which country was meant is not allowed here.
  const exact = rows.filter(r => normalizeName(r.name) === wanted)
  if (exact.length) return exact.length === 1 ? exact[0] : null

  // Fall back to the single trailing-'e' Dutch inflection, in both directions
  // ('nederlandse' ↔ 'nederlands'), and only when exactly one row matches.
  const variants = new Set<string>([`${wanted}e`])
  if (wanted.endsWith('e')) variants.add(wanted.slice(0, -1))
  const inflected = rows.filter(r => variants.has(normalizeName(r.name)))
  return inflected.length === 1 ? inflected[0] : null
}

/**
 * The visibility decision. Reads top-down as a list of reasons to KEEP SHOWING;
 * only the final line can hide the card.
 */
export function isWorkPermitBlockVisible(input: WorkPermitVisibilityInput): boolean {
  const { nationality, companyCountry, rows, lookupResolved, dataState } = input

  // Only a card we can PROVE is empty may be hidden. Existing residence-right data
  // is never hidden whatever the nationality says (it would become unreachable),
  // and neither is a card whose contents we cannot currently see at all.
  if (dataState !== 'empty') return true

  // An unknown nationality is not proof of sameness.
  if (!normalizeName(nationality)) return true

  // Nothing to compare against until the tenant's own country is configured/loaded.
  const company = (companyCountry ?? '').trim().toUpperCase()
  if (!company) return true

  // The lookup is the only name → country-code bridge; unanswered or failed
  // means unproven, never "same".
  if (!lookupResolved) return true

  // An unresolvable nationality, or a row with no country behind it (the seeded
  // 'Overig' row has country_code null), is likewise unproven.
  const row = resolveNationalityRow(rows, nationality)
  const code = (row?.country_code ?? '').trim().toUpperCase()
  if (!code) return true

  // Provably a different country → the work-permit question is real.
  if (code !== company) return true

  // Same country as the company. Hide only when the tenant's own lookup ALSO
  // marks it EU/EEA, so the card can never vanish on a candidate the backend's
  // WorkPermitGuard would still block at match creation — that guard keys on
  // `is_eu` alone, so a non-EU nationality keeps its card even at home.
  return row?.is_eu !== true
}
