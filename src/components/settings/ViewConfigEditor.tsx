/**
 * ViewConfigEditor — arrange a single module's view: toggle blocks on/off and
 * reorder them. Saves to `view.<module>` so the dashboard's <ModuleView> follows.
 *
 * Reorder is done with up/down controls (robust, no drag dependency).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GripVertical, ArrowUp, ArrowDown, Check, Save } from 'lucide-react'
import { MODULES } from '@/lib/settings/moduleRegistry'
import { useAllSettings, useSettingsLoadState, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { viewConfigKey } from '@/lib/settings/useModuleView'
import Spinner from '@/components/ui/Spinner'
import SaveButton from '@/components/ui/SaveButton'
import Button from '@/components/ui/Button'
import Toggle from '@/components/ui/Toggle'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { PageTitle } from '@/components/ui/typography'

interface Row { id: string; enabled: boolean }
interface SavedRow { id: string; enabled?: boolean }
type SettingsBlob = Record<string, unknown>

// Merge saved config with the registry so newly added blocks always appear.
function buildRows(moduleId: string, values: SettingsBlob): Row[] {
  const blocks = MODULES[moduleId]?.blocks ?? []
  const saved = getJsonSetting<SavedRow[] | null>(values, viewConfigKey(moduleId), null)
  if (!Array.isArray(saved)) return blocks.map(b => ({ id: b.id, enabled: true }))
  const known = new Set(saved.map(s => s.id))
  const rows = saved
    .filter(s => blocks.some(b => b.id === s.id))
    .map(s => ({ id: s.id, enabled: s.enabled !== false }))
  blocks.forEach(b => { if (!known.has(b.id)) rows.push({ id: b.id, enabled: true }) })
  return rows
}

// Lets a tenant toggle and reorder one dashboard module's blocks (see file
// docblock above), re-syncing its local row order whenever the module or its
// saved config changes.
export default function ViewConfigEditor({ module }: { module: string }) {
  const { t } = useTranslation('settings')
  const values = useAllSettings()
  // SETTINGS-LOAD-ERROR-1: this editor is gated on the shared /settings blob —
  // surface a real retry banner instead of silently rendering an all-default view.
  const { state: loadState, retry: retryLoad } = useSettingsLoadState()
  const mod = MODULES[module]
  const [rows, setRows] = useState<Row[]>(() => buildRows(module, values))
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  // Re-sync when the module changes or settings load in.
  const [prevKey, setPrevKey] = useState(module)
  const valuesKey = values[viewConfigKey(module)]
  const [prevValues, setPrevValues] = useState(valuesKey)
  if (module !== prevKey || valuesKey !== prevValues) {
    setPrevKey(module); setPrevValues(valuesKey)
    setRows(buildRows(module, values))
  }

  if (!mod) return null
  const blockById = Object.fromEntries(mod.blocks.map(b => [b.id, b]))

  const toggle = (id: string) => setRows(rs => rs.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  const move = (i: number, dir: number) => setRows(rs => {
    const j = i + dir
    if (j < 0 || j >= rs.length) return rs
    const next = [...rs];[next[i], next[j]] = [next[j], next[i]]; return next
  })

  // User pressed save: persists the block on/off + order, then flashes "saved" briefly.
  const save = async () => {
    setSaving(true)
    try {
      await saveSettingsKeys({ [viewConfigKey(module)]: rows })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {/* SETTINGS-LOAD-ERROR-1: the load failed — an offline-looking blank editor
          is worse than an honest banner with a retry. */}
      {loadState === 'failed' && (
        <ErrorBanner variant="subtle" onRetry={retryLoad} style={{ marginBottom: 12 }}>
          {t('common.loadError')}
        </ErrorBanner>
      )}
      <div className="flex items-center justify-between mb-5">
        <div>
          {/* Module + block names are i18n keys in the registry (§5). No toLowerCase()
              on the interpolated label: lowercasing a translated noun is wrong in
              German ("Kunden" → "kunden") and the sentences read fine capitalised. */}
          <PageTitle>{t('viewConfig.title', { label: t(mod.labelKey) })}</PageTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {t('viewConfig.description', { label: t(mod.labelKey) })}
          </p>
        </div>
        {/* SaveButton — the ONE saved-state save action (§4 success token pair). */}
        <SaveButton saved={saved} onClick={save} disabled={saving || loadState === 'failed'} aria-label={t('common.save')}>
          {saved ? <><Check size={13} /> {t('common.saved')}</> : saving ? <><Spinner size={13} /> {t('common.saving')}</> : <><Save size={13} /> {t('common.save')}</>}
        </SaveButton>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {rows.map((row, i) => {
          const block = blockById[row.id]
          if (!block) return null
          const Icon = block.icon
          return (
            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', opacity: row.enabled ? 1 : 0.55 }}>
              <GripVertical size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              {Icon && (
                <div style={{ width: 30, height: 30, borderRadius: 8, background: block.bg, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={15} color={block.color} />
                </div>
              )}
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{t(block.labelKey)}</span>

              <Button variant="secondary" iconOnly onClick={() => move(i, -1)} disabled={i === 0} title={t('viewConfig.moveUp')} aria-label={t('viewConfig.moveUp')}>
                <ArrowUp size={13} />
              </Button>
              <Button variant="secondary" iconOnly onClick={() => move(i, 1)} disabled={i === rows.length - 1} title={t('viewConfig.moveDown')} aria-label={t('viewConfig.moveDown')}>
                <ArrowDown size={13} />
              </Button>

              {/* Enable toggle — the shared switch, never a hand-rolled pill. The
                  accessible NAME stays stable (the block's label); the STATE is
                  aria-checked — a name that flips hide/show double-signals state. */}
              <Toggle checked={row.enabled} onChange={() => toggle(row.id)}
                title={row.enabled ? t('viewConfig.hide') : t('viewConfig.show')}
                ariaLabel={t(block.labelKey)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
