/**
 * HelloflexContractMapSettings (HF-CONTRACTMAP-1, Settings → HelloFlex → Contractmap) —
 * one row per tenant contract-form lookup value (candidate_types, §3B "Contractvorm";
 * `useLookups().candidateTypes`, NEVER a hardcoded slug list per CLAUDE.md), letting the
 * tenant enter the matching HelloFlex contract-type id (digits) + a human label. Persisted as one
 * JSON settings value under the key `helloflex_contract_type_map`
 * ({ [slug]: { guid: string, label: string, ...extra keys such as self_employed } }) via the shared GET/POST /settings
 * helpers (mirrors every other settings screen — see settingsApi.js docblock).
 *
 * An empty mapping for a given contract form is a legal, saved state (backend passthrough,
 * CONTRACT-CHANGELOG.md "HF-CONTRACTMAP-1" §4) — it just means the manual send-to-HelloFlex
 * path and the bulk coupling honestly skip/409 that contract form until the tenant fills it
 * in here (no silent wrong-contract sends).
 *
 * Gated in the registry on `requiresPage: 'helloflex'` (→ canAccessPage → hasModule
 * ('helloflex'), mirrors the sm/hf module-gated planning/whatsapp sections) — a tenant
 * without the HelloFlex module never sees this sub-tab.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Save } from 'lucide-react'
import { useLookups } from '@/context/LookupsContext'
import { loadSettings, saveSettings } from '../lib/settingsApi'
import { notifyError } from '@/lib/notify'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import Button from '@/components/ui/Button'
import { PageTitle, formLabelStyle, PageSubtitle } from '@/components/ui/typography'

const SETTINGS_KEY = 'helloflex_contract_type_map'

// One mapped row: HelloFlex integer contract-type id (field still named `guid` on the wire) + a free-text
// label; extra keys such as `self_employed` ride along untouched so an edit never drops them.
type MapRow = { guid: string; label: string } & Record<string, unknown>
type ContractMap = Record<string, MapRow>

// Shared FormLabel identity (12/500/muted) + this file's own layout (§4: identity from the atom, layout local).
const labelStyle = { ...formLabelStyle, marginBottom: 4, display: 'block' }

// One row per tenant contract-form, mapping to a HelloFlex contract-type id + label (see file
// docblock above); an empty mapping is a legal saved state, not a bug.
export default function HelloflexContractMapSettings() {
  const { t } = useTranslation('settings')
  // Contract-form values come from the tenant's own lookup — never hardcoded here.
  const { candidateTypes } = useLookups()
  const [map, setMap] = useState<ContractMap>({})
  const [initial, setInitial] = useState<ContractMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load the stored JSON map once; a missing/corrupt value falls back to {} — every
  // contract form then simply renders an empty (legal) row rather than crashing.
  useEffect(() => {
    let alive = true
    loadSettings().then((s) => {
      if (!alive) return
      let parsed: ContractMap = {}
      const raw = s?.[SETTINGS_KEY]
      if (typeof raw === 'string' && raw) {
        try { parsed = JSON.parse(raw) } catch { parsed = {} }
      } else if (raw && typeof raw === 'object') {
        parsed = raw as ContractMap
      }
      setMap(parsed)
      setInitial(parsed)
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const setRow = (slug: string, patch: Partial<MapRow>) =>
    setMap((prev) => ({ ...prev, [slug]: { ...prev[slug], guid: prev[slug]?.guid ?? '', label: prev[slug]?.label ?? '', ...patch } }))

  const dirty = JSON.stringify(map) !== JSON.stringify(initial)

  // Optimistic save with revert-on-failure (house pattern) — the visible rows only
  // ever reflect either the last persisted map or the in-progress edit, never a
  // half-applied server state.
  const save = async () => {
    setSaving(true)
    const previous = initial
    try {
      // Drop rows with blank id and label and no other key; keep every extra key of a kept row verbatim.
      const cleaned: ContractMap = {}
      Object.entries(map).forEach(([slug, row]) => {
        const hasExtra = Object.keys(row).some((k) => k !== 'guid' && k !== 'label')
        if (row.guid.trim() || row.label.trim() || hasExtra) cleaned[slug] = { ...row, guid: row.guid.trim(), label: row.label.trim() }
      })
      await saveSettings({ [SETTINGS_KEY]: JSON.stringify(cleaned) })
      setMap(cleaned)
      setInitial(cleaned)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setMap(previous)
      notifyError(t('helloflexContractMap.saveError'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>

  return (
    <div style={{ maxWidth: 640 }}>
      <PageTitle>{t('helloflexContractMap.title')}</PageTitle>
      <PageSubtitle as="p" style={{ marginTop: 2, marginBottom: 20 }}>{t('helloflexContractMap.subtitle')}</PageSubtitle>

      {candidateTypes.length === 0 ? (
        <PageSubtitle as="p">{t('helloflexContractMap.empty')}</PageSubtitle>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
          {candidateTypes.map((ct) => {
            const row: MapRow = map[ct.value] ?? { guid: '', label: '' }
            return (
              <div key={ct.value} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 10, alignItems: 'end' }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', paddingBottom: 8 }}>{ct.label}</span>
                <div>
                  <label htmlFor={`hf-map-guid-${ct.value}`} style={labelStyle}>{t('helloflexContractMap.guid')}</label>
                  <input id={`hf-map-guid-${ct.value}`} value={row.guid} onChange={(e) => setRow(ct.value, { guid: e.target.value.replace(/\D/g, '') })}
                    inputMode="numeric" pattern="[0-9]*" maxLength={12}
                    placeholder={t('helloflexContractMap.guidPlaceholder')} style={fieldInputStyle} />
                </div>
                <div>
                  <label htmlFor={`hf-map-label-${ct.value}`} style={labelStyle}>{t('helloflexContractMap.label')}</label>
                  <input id={`hf-map-label-${ct.value}`} value={row.label} onChange={(e) => setRow(ct.value, { label: e.target.value })}
                    placeholder={t('helloflexContractMap.labelPlaceholder')} style={fieldInputStyle} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Button variant="primary" onClick={save} disabled={saving || !dirty}>
        {saved ? <Check size={14} /> : <Save size={14} />}
        {saved ? t('common.saved') : t('common.save')}
      </Button>
    </div>
  )
}
