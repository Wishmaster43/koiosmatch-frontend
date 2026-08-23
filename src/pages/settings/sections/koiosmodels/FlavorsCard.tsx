/**
 * FlavorsCard — the platform-wide Snel/Slim/Max → vendor model map. Each stand
 * gets a searchable model picker over `available` (never a native <select>,
 * CLAUDE.md §3A) plus an honest Caption when the picked model has no effort
 * knob (catalog[id].supports_effort === false — the "Haiku-eerlijkheid" the
 * brief asks for), and a Mono cost hint pulled from the same catalog entry.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Zap, Sparkles, Crown } from 'lucide-react'
import CreatableSelect from '@/components/ui/CreatableSelect'
import SaveButton from '@/components/ui/SaveButton'
import { SectionTitle, Caption, Mono } from '@/components/ui/typography'
import { extractApiError } from '@/lib/extractApiError'
import { patchKoiosModelsAdmin } from './api'
import { FLAVOR_KEYS } from './types'
import type { FlavorKey, KoiosModelInfo, KoiosCatalogEntry, KoiosModelsAdminData } from './types'

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const TIER_ICON = { snel: Zap, slim: Sparkles, max: Crown }

// Compact "€x in / €y out per 1M" cost hint — omitted entirely when the catalog
// carries no price fields, rather than rendering "€undefined".
function costHint(entry?: KoiosCatalogEntry): string | null {
  if (!entry || entry.input_price_per_1m == null || entry.output_price_per_1m == null) return null
  return `€${entry.input_price_per_1m} / €${entry.output_price_per_1m} per 1M`
}

export default function FlavorsCard({ data, onSaved }: { data: KoiosModelsAdminData; onSaved: (patch: Partial<KoiosModelsAdminData>) => void }) {
  const { t } = useTranslation('settings')
  const [draft, setDraft] = useState(data.flavors)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = FLAVOR_KEYS.some(k => draft[k] !== data.flavors[k])
  // CreatableSelect labels are plain strings — the Mono model id rides along in
  // the label text itself rather than as embedded JSX.
  const options = data.available.map((m: KoiosModelInfo) => ({
    value: m.id, label: `${m.display_name} · ${m.id}`,
  }))

  // Persist only the flavours section — never the whole document.
  const save = async () => {
    setSaving(true); setError(null)
    try {
      const next = await patchKoiosModelsAdmin({ flavors: draft })
      onSaved({ flavors: next.flavors })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(extractApiError(err, t('koiosModelsAdmin.saveFailed')))
    }
    setSaving(false)
  }

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('koiosModelsAdmin.flavors.title')}</SectionTitle>
      <Caption style={{ display: 'block', marginBottom: 12 }}>{t('koiosModelsAdmin.flavors.subtitle')}</Caption>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {FLAVOR_KEYS.map((flavor: FlavorKey) => {
          const Icon = TIER_ICON[flavor]
          const modelId = draft[flavor]
          const entry = data.catalog?.[modelId]
          const hint = costHint(entry)
          return (
            <div key={flavor} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 90, flexShrink: 0 }}>
                <Icon size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{t(`koiosModelsAdmin.flavorLabel.${flavor}`)}</span>
              </div>
              <CreatableSelect
                value={modelId}
                options={options}
                allowCreate={false}
                onChange={v => setDraft(d => ({ ...d, [flavor]: v }))}
                placeholder={t('koiosModelsAdmin.flavors.pickPlaceholder')}
                menuWidth={320}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {entry && !entry.supports_effort && (
                  <Caption>{t('koiosModelsAdmin.flavors.noEffort')}</Caption>
                )}
                {hint && <Caption><Mono>{hint}</Mono></Caption>}
              </div>
            </div>
          )
        })}
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
