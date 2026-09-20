/**
 * CandidateRequiredFieldsSettings — Settings → Candidate → Required fields.
 *
 * Danny 09-08: "I'm missing a lot of fields, like mobile. I want ALL the fields that
 * belong to the candidate to show up here. If someone adds an extra field, it must show
 * up here too as a block and be markable as required." This screen used to offer 18 hardcoded
 * fields — a self-imposed limit, since the backend guard has no whitelist at all. It now
 * renders the full catalog (requiredFieldsCatalog.ts, ~30 fields incl. `mobile`) in
 * collapsible blocks, plus the tenant's own custom fields in their own block.
 *
 * ── Two storage locations, on purpose ──────────────────────────────────────────────
 * Built-in fields live in the tenant `/settings` blob under `candidate_required_fields`
 * as `{ <phase>: [field_keys] }` — the exact shape `RequiredFieldsGuard::builtInRequired()`
 * reads, and the shape is preserved untouched here. Custom fields do NOT: the same guard
 * reads their requirement from the definition (`required` / `required_phases`), so that
 * block PATCHes `/custom-fields/{id}` instead. Writing a custom-field key into the setting
 * would be a dead switch (§3) — see CandidateCustomRequiredFields.
 *
 * No seeded display defaults: with the key absent the guard returns `[]` per phase, so
 * "everything off" is the honestly-enforced state (same call as the customer matrix).
 * Thin container — the blocks, the matrix and the custom-field writes live in
 * sections/candidates/ (§3 size discipline).
 *
 * ── FIELDS-2-FE-1 (17-09): rows/groups now come from `GET /settings/field-inventory`
 * (VERPLICHTE-VELDEN-INVENTARIS-1) via `useFieldInventory('candidate')`, never the static
 * catalog — the endpoint is the one source both this screen and the write-time 422 read
 * from. Labels still come from `requiredFieldsCatalog.ts`'s existing `labelKey` map (kept
 * as that map only — see CANDIDATE_FIELD_LABEL_KEYS); a key the map lacks falls back to
 * rendering its raw key. A `requires_permission` field is hidden without that permission;
 * a `requirable:false` field stays visible but disabled with its reason (RequiredFieldsGroup).
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSettings, useSettingsLoaded, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { useLookups } from '@/context/LookupsContext'
import { useAuth } from '@/context/AuthContext'
import CandidateCustomRequiredFields from './candidates/CandidateCustomRequiredFields'
import RequiredFieldsGroup, { type InventoryFieldGroup, type PhaseColumn } from './candidates/RequiredFieldsGroup'
import { CANDIDATE_FIELD_LABEL_KEYS, normalizeRequiredFieldKeys, reasonI18nKey } from './candidates/requiredFieldsCatalog'
import { useFieldInventory } from '../hooks/useFieldInventory'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { BodyText } from '@/components/ui/typography'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import SettingsLoadBanner from '../components/SettingsLoadBanner'
// audit r2-ui-states-3: a failed save must tell the admin, not silently revert (the api client's toast is DEV-only).

const KEY = 'candidate_required_fields'

// Thin container over the field inventory + custom fields (see the module doc above for the two separate storage paths — built-in fields in the settings blob, custom fields on their own definition).
export default function CandidateRequiredFieldsSettings() {
  const { t } = useTranslation(['settings', 'candidates'])
  const { phases } = useLookups()
  const auth = useAuth()
  const hasPermission = auth?.hasPermission ?? (() => false)
  const values = useAllSettings()
  // REQFIELDS-TOGGLE-RACE-1: a click before GET /settings resolves would rebuild
  // the WHOLE phase-keyed map from the {} fallback and wipe every phase's list.
  const loaded = useSettingsLoaded()
  const cfg = getJsonSetting<Record<string, string[]>>(values, KEY, {})
  const { groups: invGroups, fields: invFields, isLoading, isError, refetch } = useFieldInventory('candidate')

  // Phase columns come from the tenant lookup; LookupsContext already seeds lead/candidate.
  const cols: PhaseColumn[] = phases.map(p => ({ value: String(p.value), label: String(p.label) }))

  // requires_permission rows are hidden entirely for a caller without that permission
  // (the financial block, gated on candidates.financial.view) — never shown-disabled.
  const visibleFields = invFields.filter(f => !f.requires_permission || hasPermission(f.requires_permission))

  // Keys the inventory currently marks non-requirable — used both to translate the
  // reason and to strip any stored no-op value from the saved setting (see toggle()).
  const nonRequirableKeys = new Set(invFields.filter(f => !f.requirable).map(f => f.key))

  // Groups/order come straight from the inventory; a key the label map lacks falls back
  // to its raw key rather than crashing the screen on a not-yet-labelled field. The raw
  // English reason (relation/consent/financial/webhook-stamped/custom-fields) is mapped
  // to its i18n key here — a reason the map doesn't recognise falls back to the raw text
  // rather than hiding it.
  const groups: InventoryFieldGroup[] = invGroups
    .map(g => ({
      id: g.key,
      titleKey: g.label_key,
      fields: visibleFields
        .filter(f => f.group === g.key)
        .map(f => {
          const reasonKey = f.reason ? reasonI18nKey(f.reason) : null
          return {
            key: f.key, labelKey: CANDIDATE_FIELD_LABEL_KEYS[f.key] ?? f.key, requirable: f.requirable,
            reason: f.reason ? (reasonKey ? t(reasonKey) : f.reason) : null,
          }
        }),
    }))
    .filter(g => g.fields.length > 0)

  // Membership is read through the alias fold, so a legacy `postal_code`/`linkedin` entry
  // still shows as its working key instead of silently reading as "not required".
  const isRequired = useCallback((phase: string, field: string) =>
    normalizeRequiredFieldKeys(cfg[phase] ?? []).includes(field), [cfg])

  // Persist the whole phase-keyed map. Every phase is folded onto guard-readable keys on
  // the way out: the aliases can never be satisfied, so leaving one in place would block
  // every save for that phase — folding keeps the tenant's intent on a key that works.
  // A key the inventory currently marks non-requirable is dropped on every save (never
  // added by a click either, since the shared table disables its toggle): a stored
  // no-op would otherwise ride along invisibly while the admin can no longer see or
  // clear it (§3 no fake affordance).
  const toggle = (phase: string, field: string) => {
    if (!loaded || nonRequirableKeys.has(field)) return
    const next: Record<string, string[]> = {}
    for (const [p, list] of Object.entries(cfg)) {
      next[p] = normalizeRequiredFieldKeys(list ?? []).filter(k => !nonRequirableKeys.has(k))
    }
    const current = next[phase] ?? []
    next[phase] = current.includes(field) ? current.filter(x => x !== field) : [...current, field]
    saveSettingsKeys({ [KEY]: next }).catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
  }

  // Open the blocks that already have something required, initialised once the inventory's
  // groups actually arrive (the inventory is async, unlike the old static catalog) — a
  // later refetch never re-collapses a block the admin has since opened/closed by hand.
  const [openIds, setOpenIds] = useState<string[]>([])
  const [openInitialised, setOpenInitialised] = useState(false)
  useEffect(() => {
    if (openInitialised || groups.length === 0) return
    const withRequired = groups
      .filter(g => g.fields.some(f => cols.some(c => isRequired(c.value, f.key))))
      .map(g => g.id)
    setOpenIds(withRequired.length ? withRequired : [groups[0].id])
    setOpenInitialised(true)
    // Full deps on purpose: the `openInitialised` guard above makes every re-run after the
    // first a no-op, so re-including cols/isRequired never re-opens/closes anything by hand.
  }, [groups, cols, isRequired, openInitialised])
  const toggleOpen = (id: string) => setOpenIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])

  // Real state, not a fixed label: only once every group is open does the button offer to
  // collapse — a mixed, fully-closed or not-yet-loaded state always offers to expand.
  const allGroupsOpen = groups.length > 0 && groups.every(g => openIds.includes(g.id))
  const toggleAllGroups = () => setOpenIds(allGroupsOpen ? [] : groups.map(g => g.id))

  return (
    <div style={{ maxWidth: 760 }}>
      <SettingsLoadBanner />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('requiredFields.title')}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('requiredFields.subtitle')}</p>
        </div>
        {/* One toggle drives every built-in group at once (v1 scope only —
            CandidateCustomRequiredFields keeps its own open state). The label always
            names the action that reveals more: "expand" while anything is closed,
            "collapse" only once everything is already open. */}
        <Button variant="secondary" size="sm" onClick={toggleAllGroups} disabled={groups.length === 0}>
          {allGroupsOpen ? t('requiredFields.collapseAll') : t('requiredFields.expandAll')}
        </Button>
      </div>

      {/* Four explicit states (§3): loading the inventory, a failed fetch with retry,
          an (unexpected but honest) empty inventory, and the real matrix. */}
      {isLoading && <Spinner />}
      {!isLoading && isError && (
        <ErrorBanner onRetry={() => refetch()}>{t('requiredFields.inventoryLoadFailed')}</ErrorBanner>
      )}
      {!isLoading && !isError && groups.length === 0 && (
        <BodyText style={{ color: 'var(--text-muted)' }}>{t('requiredFields.inventoryEmpty')}</BodyText>
      )}
      {!isLoading && !isError && groups.map(group => (
        <RequiredFieldsGroup key={group.id} group={group} phases={cols}
          isRequired={isRequired} onToggle={toggle} disabled={!loaded}
          open={openIds.includes(group.id)} onOpenToggle={() => toggleOpen(group.id)} />
      ))}

      {/* Tenant custom fields — same matrix, but saved on the definition itself. */}
      <CandidateCustomRequiredFields phases={cols} />
    </div>
  )
}
