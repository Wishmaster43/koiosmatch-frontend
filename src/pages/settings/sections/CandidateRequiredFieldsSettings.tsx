/**
 * CandidateRequiredFieldsSettings — Settings → Kandidaat → Verplichte velden.
 *
 * Danny 09-08: "ik mis heel veel velden zoals mobiel. Ik wil dat ALLE velden hier staan
 * die bij de kandidaat staan. Maakt iemand een extra veld, dan moet die hier ook komen
 * als blokje en ook verplicht kunnen worden." This screen used to offer 18 hardcoded
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
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSettings, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { useLookups } from '@/context/LookupsContext'
import CandidateCustomRequiredFields from './candidates/CandidateCustomRequiredFields'
import RequiredFieldsGroup, { type PhaseColumn } from './candidates/RequiredFieldsGroup'
import { CANDIDATE_FIELD_GROUPS, normalizeRequiredFieldKeys } from './candidates/requiredFieldsCatalog'

const KEY = 'candidate_required_fields'

export default function CandidateRequiredFieldsSettings() {
  const { t } = useTranslation(['settings', 'candidates'])
  const { phases } = useLookups()
  const values = useAllSettings()
  const cfg = getJsonSetting<Record<string, string[]>>(values, KEY, {})

  // Phase columns come from the tenant lookup; LookupsContext already seeds lead/candidate.
  const cols: PhaseColumn[] = phases.map(p => ({ value: String(p.value), label: String(p.label) }))

  // Membership is read through the alias fold, so a legacy `postal_code`/`linkedin` entry
  // still shows as its working key instead of silently reading as "not required".
  const isRequired = (phase: string, field: string) =>
    normalizeRequiredFieldKeys(cfg[phase] ?? []).includes(field)

  // Persist the whole phase-keyed map. Every phase is folded onto guard-readable keys on
  // the way out: the aliases can never be satisfied, so leaving one in place would block
  // every save for that phase — folding keeps the tenant's intent on a key that works.
  const toggle = (phase: string, field: string) => {
    const next: Record<string, string[]> = {}
    for (const [p, list] of Object.entries(cfg)) next[p] = normalizeRequiredFieldKeys(list ?? [])
    const current = next[phase] ?? []
    next[phase] = current.includes(field) ? current.filter(x => x !== field) : [...current, field]
    saveSettingsKeys({ [KEY]: next }).catch(() => {})
  }

  // Open the blocks that already have something required (computed once, on mount), so a
  // ~30-field screen opens on what matters instead of on a wall of collapsed bars.
  const [openIds, setOpenIds] = useState<string[]>(() => {
    const withRequired = CANDIDATE_FIELD_GROUPS
      .filter(g => g.fields.some(f => cols.some(c => isRequired(c.value, f.key))))
      .map(g => g.id)
    return withRequired.length ? withRequired : [CANDIDATE_FIELD_GROUPS[0].id]
  })
  const toggleOpen = (id: string) => setOpenIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])

  return (
    <div style={{ maxWidth: 760 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('requiredFields.title')}</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t('requiredFields.subtitle')}</p>

      {/* Built-in fields — one collapsible block per card of the candidate screens. */}
      {CANDIDATE_FIELD_GROUPS.map(group => (
        <RequiredFieldsGroup key={group.id} group={group} phases={cols}
          isRequired={isRequired} onToggle={toggle}
          open={openIds.includes(group.id)} onOpenToggle={() => toggleOpen(group.id)} />
      ))}

      {/* Tenant custom fields — same matrix, but saved on the definition itself. */}
      <CandidateCustomRequiredFields phases={cols} />
    </div>
  )
}
