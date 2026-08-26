/**
 * RoutingCard — per request-type flavour + effort routing. Chat is deliberately
 * absent from the four rows (note/generate/conversation/report-advice only) —
 * a Caption explains it follows the tenant's own flavour pick instead. The
 * effort picker collapses to "standard" and hides its options whenever the
 * routed flavour's model doesn't support an effort knob (catalog lookup).
 */
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import SaveButton from '@/components/ui/SaveButton'
import { SectionTitle, Caption } from '@/components/ui/typography'
import { extractApiError } from '@/lib/extractApiError'
import { patchKoiosModelsAdmin } from './api'
import { REQUEST_TYPES, EFFORT_LEVELS } from './types'
import type { KoiosRequestType, KoiosRoutingEntry, KoiosModelsAdminData } from './types'

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const NO_EFFORT_VALUE = '' // maps to null — "standaard" (tenant/platform default)

// Per-request-type flavour + effort routing card: a local draft against the tenant's saved routing, diffed for dirty state.
export default function RoutingCard({ data, onSaved }: { data: KoiosModelsAdminData; onSaved: (patch: Partial<KoiosModelsAdminData>) => void }) {
  const { t } = useTranslation('settings')
  const [draft, setDraft] = useState<Record<KoiosRequestType, KoiosRoutingEntry>>(data.routing)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = REQUEST_TYPES.some(rt => JSON.stringify(draft[rt]) !== JSON.stringify(data.routing[rt]))
  // Memoised: option list only changes with the tenant's flavor catalog or the active locale.
  const flavorOptions = useMemo(() => (Object.keys(data.flavors) as Array<keyof typeof data.flavors>).map(f => ({
    value: f, label: t(`koiosModelsAdmin.flavorLabel.${f}`),
  })), [data, t])
  // Memoised like flavorOptions above — a fresh identity per render defeats the select's memo.
  const effortOptions = useMemo(() => [
    { value: NO_EFFORT_VALUE, label: t('koiosModelsAdmin.routing.effortDefault') },
    ...EFFORT_LEVELS.map(e => ({ value: e, label: t(`koiosModelsAdmin.effortLevel.${e}`) })),
  ], [t])

  // Persist the draft routing and surface the real error on failure, mirroring SaveButton's transient saved state.
  const save = async () => {
    setSaving(true); setError(null)
    try {
      const next = await patchKoiosModelsAdmin({ routing: draft })
      onSaved({ routing: next.routing })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(extractApiError(err, t('koiosModelsAdmin.saveFailed')))
    }
    setSaving(false)
  }

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('koiosModelsAdmin.routing.title')}</SectionTitle>
      <Caption style={{ display: 'block', marginBottom: 4 }}>{t('koiosModelsAdmin.routing.subtitle')}</Caption>
      <Caption style={{ display: 'block', marginBottom: 12 }}>{t('koiosModelsAdmin.routing.chatNote')}</Caption>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {REQUEST_TYPES.map((rt: KoiosRequestType) => {
          const entry = draft[rt]
          const modelId = data.flavors[entry.flavor]
          const supportsEffort = data.catalog?.[modelId]?.supports_effort !== false
          return (
            <div key={rt} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, width: 150, flexShrink: 0 }}>
                {t(`koiosModelsAdmin.requestType.${rt}`)}
              </span>
              <CreatableSelect
                value={entry.flavor}
                options={flavorOptions}
                allowCreate={false}
                onChange={v => setDraft(d => {
                  // Switching to a model without effort support must also DROP
                  // the stale effort — hiding the picker alone still PATCHed
                  // the old value (Opus round).
                  const nextFlavor = v as typeof entry.flavor
                  const nextSupports = data.catalog?.[data.flavors[nextFlavor]]?.supports_effort !== false
                  return { ...d, [rt]: { ...d[rt], flavor: nextFlavor, effort: nextSupports ? d[rt].effort : null } }
                })}
                menuWidth={160}
              />
              {supportsEffort ? (
                <CreatableSelect
                  value={entry.effort ?? NO_EFFORT_VALUE}
                  options={effortOptions}
                  allowCreate={false}
                  onChange={v => setDraft(d => ({ ...d, [rt]: { ...d[rt], effort: v === NO_EFFORT_VALUE ? null : (v as NonNullable<typeof entry.effort>) } }))}
                  menuWidth={160}
                />
              ) : (
                <Caption>{t('koiosModelsAdmin.flavors.noEffort')}</Caption>
              )}
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
