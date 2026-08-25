/**
 * useContractTypes — tenant-configurable contract types for a match
 * (Settings → Matches). NBBU/ABU fasen differ per bureau, so it is a tenant lookup,
 * never hardcoded. Fed by GET /contract-types; a seed fallback drives the dropdown
 * only when that response carries nothing usable.
 *
 * BACKEND CONTRACT (verified against koiosmatch-api, 2026-07-31 — this replaces the
 * old "honest-gate" note that said the columns did not exist yet; they do):
 *  - `GET /contract-types` is registered on the auth:sanctum + tenant group with NO
 *    permission middleware, so any authenticated tenant user may read it. Only the
 *    Settings writes (POST/PUT/DELETE) require `permission:settings.update`, which is
 *    why nothing in this read path is permission-gated.
 *  - `default_duration_days` (integer|null, validated 1..3650) and `is_default`
 *    (boolean, a HasSingletonFlag — at most one row carries it) are real columns.
 *    index() returns raw Eloquent models, so BOTH always serialise — no Resource, no
 *    whenLoaded, no $hidden to strip them.
 *  - Each row's `value` is an IMMUTABLE SLUG (`bepaalde_tijd`) and `label` is the
 *    tenant's editable wording (`Bepaalde tijd`). A match stores the SLUG:
 *    App\Support\MatchRules::normalise normalises a posted label to its `value` before
 *    saving, because the lookup's in-use/DELETE-409 guard JOINs on that column.
 *    Posting either form is accepted; reading one back always yields the slug.
 *
 * OUT OF THE BOX BOTH COLUMNS ARE EMPTY. MatchOutreachLookupSeeder seeds the six
 * types with value/label/color/sort_order/active only, so a fresh tenant has
 * `default_duration_days: null` and `is_default: false` on every row. The end-date
 * proposal and the default preselect are therefore inert until a tenant actually
 * configures one in Settings — correct honest behaviour, not a gate.
 *
 * `types` (string[]) stays exactly as before for the callers that only need the
 * label list (ContractSection's dropdown, the matches drawer, the vacancy-generation
 * matcher); `options` carries the full row for the two proposals above.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 *
 * LOOKUP-I18N-1 (25-08, fix round): `options.label` IS translated (a seeded
 * default renders in the user's language; `options.value` — the immutable slug —
 * never is). `types`, deliberately, is NOT: every `types` consumer treats the
 * string as BOTH the picker's value and its label (value === label), and this
 * hook's own contract above states a match stores that string directly — the
 * backend's `MatchRules::normalise` recognises the SLUG or the DUTCH label, never
 * a translated one. `types` therefore stays sourced from the untranslated rows so
 * a non-NL recruiter's pick still normalises. KNOWN RESIDUAL RISK, out of this
 * lane (useMatchForm.ts/ContractSection.tsx are match-creation logic, not a
 * lookup hook): useMatchForm.ts's own default-proposal and canonicalise effects
 * read `options.label` directly (not `types`) and store THAT in the submitted
 * `contractType` state — for a non-NL locale this still posts a translated label.
 * Closing that needs `contractType` to hold `options.value` end-to-end (Contract
 * Section binding `options` instead of `types`), a match-creation change flagged
 * for a dedicated follow-up rather than made here.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { translateSeedList } from './lookupSeedI18n'
import { unwrapList } from '@/lib/api'

// Seed defaults mirror Danny's spec (ABU + ZZP + W&S); labels tenant-facing.
export const DEFAULT_CONTRACT_TYPES = [
  'Fase 1-2 z.u.b. (Works)',
  'Fase 1-2 m.u.b. (Works)',
  'Fase 3 bepaalde tijd (Zorg)',
  'Fase 4 onbepaalde tijd',
  'ZZP Flex',
  'ZZP Project',
  'Werving & Selectie',
]

export interface ContractTypeOption { value: string; label: string; default_duration_days: number | null; is_default: boolean }

// Seed rows are label-only (value === label) and carry no duration/default — a
// fallback list can't know a tenant's configuration, so both proposals stay inert on it.
const DEFAULT_CONTRACT_TYPE_OPTIONS: ContractTypeOption[] =
  DEFAULT_CONTRACT_TYPES.map(name => ({ value: name, label: name, default_duration_days: null, is_default: false }))

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapContractTypeOptions = (res: AxiosResponse): ContractTypeOption[] | null => {
  const rows = (unwrapList(res).rows) as Array<string | { name?: string; label?: string; value?: string; default_duration_days?: number | null; is_default?: boolean }>
  const options = rows
    .map(x => {
      if (typeof x === 'string') return x ? { value: x, label: x, default_duration_days: null, is_default: false } : null
      const label = x.name ?? x.label ?? x.value ?? ''
      return label ? { value: String(x.value ?? label), label, default_duration_days: x.default_duration_days ?? null, is_default: Boolean(x.is_default) } : null
    })
    .filter((o): o is ContractTypeOption => o !== null)
  return options.length ? options : null
}

export function useContractTypes() {
  const { t } = useTranslation('common')
  // One cached GET /contract-types per session; the seed list stands in only while
  // that request is in flight or if it returns nothing usable (mapper → null).
  const { data: rawOptions } = useCachedLookup('/contract-types', mapContractTypeOptions, DEFAULT_CONTRACT_TYPE_OPTIONS)
  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  const options = useMemo(() => translateSeedList(t, 'contractTypes', rawOptions), [rawOptions, t])
  // `types` stays UNTRANSLATED on purpose (see the doc comment above) — every
  // consumer submits this exact string as `contract_type`, and only the raw
  // backend label/slug normalises server-side regardless of the user's locale.
  const types = useMemo(() => rawOptions.map(o => o.label), [rawOptions])
  return { types, options }
}
