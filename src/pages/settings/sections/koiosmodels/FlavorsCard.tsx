import { formatCurrency } from '@/lib/formatters'
import { useTranslation } from 'react-i18next'
import { Zap, Sparkles, Crown } from 'lucide-react'
import CreatableSelect from '@/components/ui/CreatableSelect'
import SaveButton from '@/components/ui/SaveButton'
import { SectionTitle, Caption, Mono } from '@/components/ui/typography'
import { patchKoiosModelsAdmin } from './api'
import { FLAVOR_KEYS } from './types'
import { useCardDraft } from './useCardDraft'
import { cardStyle } from './cardStyles'
import type { FlavorKey, KoiosModelInfo, KoiosCatalogEntry, KoiosModelsAdminData } from './types'

const TIER_ICON = { fast: Zap, smart: Sparkles, max: Crown }

// Compact cost hint — house currency formatting (§5), omitted entirely when the
// catalog carries no price fields, rather than rendering "€undefined".
function costHint(entry: KoiosCatalogEntry | undefined, fmt: (v: number) => string, per1m: string): string | null {
  if (!entry || entry.input_price_per_1m == null || entry.output_price_per_1m == null) return null
  return `${fmt(Number(entry.input_price_per_1m))} / ${fmt(Number(entry.output_price_per_1m))} ${per1m}`
}

/**
 * FlavorsCard — the platform-wide Snel/Slim/Max → vendor model map. Each stand
 * gets a searchable model picker over `available` (never a native <select>,
 * CLAUDE.md §3A) plus an honest Caption when the picked model has no effort
 * knob (catalog[id].supports_effort === false — the "Haiku-eerlijkheid" the
 * brief asks for), and a Mono cost hint pulled from the same catalog entry.
 */
export default function FlavorsCard({ data, onSaved }: { data: KoiosModelsAdminData; onSaved: (patch: Partial<KoiosModelsAdminData>) => void }) {
  const { t } = useTranslation('settings')
  const { draft, setDraft, saving, saved, error, dirty, save } = useCardDraft(
    data.flavors,
    (draft) => patchKoiosModelsAdmin({ flavors: draft }),
    (draft, original) => FLAVOR_KEYS.some(k => draft[k] !== original[k]),
    (result) => onSaved({ flavors: result.flavors }),
  )

  // Only LINKABLE models are offerable (MODELS-PERSIST-1: a live vendor id with no
  // catalogue price cannot be pinned to a flavour) — the value is the catalogue id,
  // never the raw vendor id, since that is what the PATCH must send.
  // Only models with a catalogue price are offered: linkable AND catalog_id, so the option value is never a raw vendor id.
  const linkableModels = data.available.filter((m: KoiosModelInfo) => m.linkable && m.catalog_id)
  const hiddenCount = data.available.length - linkableModels.length
  // CreatableSelect labels are plain strings — the Mono model id rides along in
  // the label text itself rather than as embedded JSX.
  const options = linkableModels.map((m: KoiosModelInfo) => ({
    value: (m.catalog_id ?? m.id) as string, label: `${m.display_name} · ${m.catalog_id ?? m.id}`,
  }))

  return (
    <div style={cardStyle}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('koiosModelsAdmin.flavors.title')}</SectionTitle>
      <Caption style={{ display: 'block', marginBottom: 12 }}>{t('koiosModelsAdmin.flavors.subtitle')}</Caption>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {FLAVOR_KEYS.map((flavor: FlavorKey) => {
          const Icon = TIER_ICON[flavor]
          const modelId = draft[flavor]
          const entry = data.catalog?.[modelId]
          const hint = costHint(entry, (v) => formatCurrency(v, 'EUR', undefined, 2, 2), t('koiosModelsAdmin.flavors.per1m'))
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

      {hiddenCount > 0 && (
        <Caption style={{ display: 'block', marginTop: 10 }}>
          {t('koiosModelsAdmin.flavors.hiddenModels', { count: hiddenCount })}
        </Caption>
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
