/**
 * TenantOverridesCard — per-tenant flavour ceiling/floor. A searchable tenant
 * picker (CreatableSelect over useAuth().tenants — the same superadmin list the
 * TenantSwitcher already loads, no second fetch) selects which override to edit;
 * `min_flavor` is a FLOOR ("tilt alle verzoeken voor deze tenant op", i.e.
 * "bump all requests for this tenant up") and
 * `allowed_flavors` a ceiling — both null/empty means no override at all.
 * Clearing sends null through PATCH rather than dropping the key, so the
 * override actually resets server-side (§3A VAC-CLEAR-1).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import SaveButton from '@/components/ui/SaveButton'
import { SectionTitle, Caption } from '@/components/ui/typography'
import { extractApiError } from '@/lib/extractApiError'
import { useAuth } from '@/context/AuthContext'
import { patchKoiosModelsAdmin } from './api'
import { FLAVOR_KEYS } from './types'
import type { FlavorKey, KoiosTenantOverride, KoiosModelsAdminData } from './types'

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: 'var(--surface)' }
const NO_FLOOR = '' // maps to null — no floor set

const EMPTY_OVERRIDE: KoiosTenantOverride = { allowed_flavors: null, min_flavor: null }

// Card body: picks a tenant then edits its flavour floor/ceiling in a local draft, saved only on explicit Save.
export default function TenantOverridesCard({ data, onSaved }: { data: KoiosModelsAdminData; onSaved: (patch: Partial<KoiosModelsAdminData>) => void }) {
  const { t } = useTranslation('settings')
  const tenants = useAuth()?.tenants ?? []
  const [tenantId, setTenantId] = useState<string>('')
  const [draft, setDraft] = useState<Record<string, KoiosTenantOverride>>(data.tenants)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tenantOptions = tenants.map((tn: { id: string; name?: string }) => ({ value: tn.id, label: tn.name ?? tn.id }))
  const current = tenantId ? (draft[tenantId] ?? EMPTY_OVERRIDE) : null
  const floorOptions = [
    { value: NO_FLOOR, label: t('koiosModelsAdmin.tenantOverrides.noFloor') },
    ...FLAVOR_KEYS.map(f => ({ value: f, label: t(`koiosModelsAdmin.flavorLabel.${f}`) })),
  ]
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.tenants)

  // Merges a partial patch into the currently selected tenant's draft override.
  const updateCurrent = (patch: Partial<KoiosTenantOverride>) => {
    if (!tenantId) return
    setDraft(d => ({ ...d, [tenantId]: { ...(d[tenantId] ?? EMPTY_OVERRIDE), ...patch } }))
  }

  // Adds/removes one flavour from the current tenant's allowed ceiling; an empty result clears it entirely (null, not []).
  const toggleFlavor = (flavor: FlavorKey) => {
    if (!tenantId || !current) return
    const list = current.allowed_flavors ?? []
    const next = list.includes(flavor) ? list.filter(f => f !== flavor) : [...list, flavor]
    updateCurrent({ allowed_flavors: next.length ? next : null })
  }

  // Persists the whole draft map in one PATCH, syncs the parent's data, and flashes the shared saved-state for 2s.
  const save = async () => {
    setSaving(true); setError(null)
    try {
      const next = await patchKoiosModelsAdmin({ tenants: draft })
      onSaved({ tenants: next.tenants })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(extractApiError(err, t('koiosModelsAdmin.saveFailed')))
    }
    setSaving(false)
  }

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('koiosModelsAdmin.tenantOverrides.title')}</SectionTitle>
      <Caption style={{ display: 'block', marginBottom: 12 }}>{t('koiosModelsAdmin.tenantOverrides.subtitle')}</Caption>

      <CreatableSelect
        value={tenantId}
        options={tenantOptions}
        allowCreate={false}
        onChange={setTenantId}
        placeholder={t('koiosModelsAdmin.tenantOverrides.pickTenant')}
        menuWidth={280}
      />

      {current && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Caption style={{ width: 140, flexShrink: 0 }}>{t('koiosModelsAdmin.tenantOverrides.minFlavor')}</Caption>
            <CreatableSelect
              value={current.min_flavor ?? NO_FLOOR}
              options={floorOptions}
              allowCreate={false}
              onChange={v => updateCurrent({ min_flavor: v === NO_FLOOR ? null : (v as FlavorKey) })}
              menuWidth={160}
            />
          </div>
          <Caption>{t('koiosModelsAdmin.tenantOverrides.minFlavorHint')}</Caption>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            <Caption style={{ width: 140, flexShrink: 0 }}>{t('koiosModelsAdmin.tenantOverrides.allowedFlavors')}</Caption>
            <ChipMultiSelect
              options={FLAVOR_KEYS.map(f => ({ value: f, label: t(`koiosModelsAdmin.flavorLabel.${f}`) }))}
              values={current.allowed_flavors ?? []}
              onToggle={v => toggleFlavor(v as FlavorKey)}
              ariaLabel={t('koiosModelsAdmin.tenantOverrides.allowedFlavors')}
              selectAll={false}
            />
          </div>
          <Caption>{t('koiosModelsAdmin.tenantOverrides.allowedFlavorsHint')}</Caption>
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>{error}</div>}
      <div style={{ marginTop: 12 }}>
        <SaveButton size="sm" saved={saved} disabled={!dirty || saving} onClick={save}>
          {t('koiosModelsAdmin.save')}
        </SaveButton>
      </div>
    </div>
  )
}
