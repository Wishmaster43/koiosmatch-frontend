/**
 * PackagesCard — per package: which flavours a tenant on that package may pick,
 * plus the effort ceiling. Flavour membership is a 3-item toggle set via the
 * shared `ChipMultiSelect` (CHIP-TINT-1 selected-chip look, §11 — never a
 * hand-rolled copy of that chip). The max-effort ceiling IS a dropdown (open
 * vocabulary) via CreatableSelect.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import SaveButton from '@/components/ui/SaveButton'
import { SectionTitle, Caption } from '@/components/ui/typography'
import { extractApiError } from '@/lib/extractApiError'
import { patchKoiosModelsAdmin } from './api'
import { FLAVOR_KEYS, EFFORT_LEVELS } from './types'
import type { FlavorKey, KoiosPackageEntry, KoiosModelsAdminData } from './types'

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }

// Per-package flavour toggles + effort ceiling editor.
export default function PackagesCard({ data, onSaved }: { data: KoiosModelsAdminData; onSaved: (patch: Partial<KoiosModelsAdminData>) => void }) {
  const { t } = useTranslation('settings')
  const [draft, setDraft] = useState<Record<string, KoiosPackageEntry>>(data.packages)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.packages)
  const effortOptions = EFFORT_LEVELS.map(e => ({ value: e, label: t(`koiosModelsAdmin.effortLevel.${e}`) }))
  const packageKeys = Object.keys(data.packages)

  // Flips one flavour's membership in a package's allowed set, in local draft state.
  const toggleFlavor = (pkg: string, flavor: FlavorKey) => {
    setDraft(d => {
      const current = d[pkg].allowed_flavors
      const next = current.includes(flavor) ? current.filter(f => f !== flavor) : [...current, flavor]
      return { ...d, [pkg]: { ...d[pkg], allowed_flavors: next } }
    })
  }

  // Persists the draft package config and adopts the server's own patched copy.
  const save = async () => {
    setSaving(true); setError(null)
    try {
      const next = await patchKoiosModelsAdmin({ packages: draft })
      onSaved({ packages: next.packages })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(extractApiError(err, t('koiosModelsAdmin.saveFailed')))
    }
    setSaving(false)
  }

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('koiosModelsAdmin.packages.title')}</SectionTitle>
      <Caption style={{ display: 'block', marginBottom: 12 }}>{t('koiosModelsAdmin.packages.subtitle')}</Caption>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {packageKeys.map(pkg => (
          <div key={pkg} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, width: 140, flexShrink: 0 }}>{pkg}</span>
            <ChipMultiSelect
              options={FLAVOR_KEYS.map(f => ({ value: f, label: t(`koiosModelsAdmin.flavorLabel.${f}`) }))}
              values={draft[pkg].allowed_flavors}
              onToggle={v => toggleFlavor(pkg, v as FlavorKey)}
              ariaLabel={t('koiosModelsAdmin.packages.title')}
              selectAll={false}
            />
            <Caption>{t('koiosModelsAdmin.packages.maxEffort')}</Caption>
            <CreatableSelect
              value={draft[pkg].max_effort}
              options={effortOptions}
              allowCreate={false}
              onChange={v => setDraft(d => ({ ...d, [pkg]: { ...d[pkg], max_effort: v as KoiosPackageEntry['max_effort'] } }))}
              menuWidth={140}
            />
          </div>
        ))}
      </div>

      {error && <div style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>{error}</div>}
      <div style={{ marginTop: 12 }}>
        <SaveButton size="sm" saved={saved} disabled={!dirty || saving} onClick={save}>
          {t('koiosModelsAdmin.save')}
        </SaveButton>
      </div>
    </div>
  )
}
