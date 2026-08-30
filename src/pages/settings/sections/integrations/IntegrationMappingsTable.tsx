/**
 * IntegrationMappingsTable (INTEGRATIONS-SETTINGS-1, Settings → Integrations →
 * Mapping tab) — the per-connector translation table between a Koios lookup
 * value and the external system's own value (e.g. CAO/scale/step/function),
 * per docs/contract/INTEGRATIONS-CONTRACT.md "Mappings". One domain strip
 * (SubTabBar) switches which domain's rows are loaded; rows edit in place
 * (dirty row shows a row-level SaveButton), a new row appends editable and
 * POSTs on its own save, and delete goes through the shared ConfirmDialog
 * (v1: always allowed — a later sync missing the mapping fails visibly on
 * that row instead, per the contract).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Check } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import SaveButton from '@/components/ui/SaveButton'
import Toggle from '@/components/ui/Toggle'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import SubTabBar from '@/components/drawer/SubTabBar'
import { PageTitle, Caption } from '@/components/ui/typography'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { listMappings, createMapping, updateMapping, deleteMapping } from './integrationsApi'
import type { MappingRow, ConnectorId } from './integrationsApi'

// Local editable-row shape: a persisted row (has `id`) or a fresh unsaved one
// (`id: null`) added via the "+" action, both keyed by a stable local `key`.
interface EditRow {
  key: string
  id: string | null
  koios_value: string
  external_value: string
  is_default: boolean
}

const toEditRow = (row: MappingRow): EditRow => ({
  key: row.id, id: row.id, koios_value: row.koios_value,
  external_value: row.external_value, is_default: row.is_default,
})

const newEditRow = (): EditRow => ({
  key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  id: null, koios_value: '', external_value: '', is_default: false,
})

export default function IntegrationMappingsTable({ connector, domains }: { connector: ConnectorId; domains: string[] }) {
  const { t } = useTranslation('settings')
  const [domain, setDomain] = useState(domains[0])
  const [reloadTick, setReloadTick] = useState(0)
  const [rows, setRows] = useState<EditRow[]>([])
  const [saved, setSaved] = useState<Record<string, MappingRow>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)

  // Load the active domain's mappings; an entity-keyed (domain) load carries an
  // alive guard so a fast domain switch never lets a stale response win (§9).
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(false)
    listMappings(connector, domain).then((data) => {
      if (!alive) return
      const savedMap: Record<string, MappingRow> = {}
      data.forEach((r) => { savedMap[String(r.id)] = r })
      setSaved(savedMap)
      setRows(data.map(toEditRow))
    }).catch(() => {
      if (!alive) return
      setError(true)
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [connector, domain, reloadTick])

  const setRow = (key: string, patch: Partial<EditRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const addRow = () => setRows((prev) => [...prev, newEditRow()])

  // Save one row: POST for a fresh row, PUT with only the changed fields for
  // an existing one — duplicate (domain, koios_value) surfaces its own message.
  const saveRow = async (row: EditRow) => {
    setSavingKey(row.key)
    try {
      if (row.id == null) {
        const created = await createMapping(connector, {
          domain, koios_value: row.koios_value, external_value: row.external_value, is_default: row.is_default,
        })
        setSaved((prev) => ({ ...prev, [String(created.id)]: created }))
        setRows((prev) => prev.map((r) => (r.key === row.key ? toEditRow(created) : r)))
      } else {
        // Mirror isDirty's guard: no original snapshot -> send the full row
        // rather than dereferencing undefined (verify finding).
        const original = saved[String(row.id)]
        const patch: Partial<MappingRow> = original
          ? {
              ...(original.koios_value !== row.koios_value ? { koios_value: row.koios_value } : {}),
              ...(original.external_value !== row.external_value ? { external_value: row.external_value } : {}),
              ...(original.is_default !== row.is_default ? { is_default: row.is_default } : {}),
            }
          : { koios_value: row.koios_value, external_value: row.external_value, is_default: row.is_default }
        const updated = await updateMapping(connector, row.id, patch)
        setSaved((prev) => ({ ...prev, [String(updated.id)]: updated }))
        setRows((prev) => prev.map((r) => (r.key === row.key ? toEditRow(updated) : r)))
      }
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 422) {
        // The server's own 422 message wins; the duplicate copy is the fallback.
        notifyError(extractApiError(err, t('integrations.mappings.duplicate')))
      } else {
        notifyError(extractApiError(err, t('integrations.mappings.saveError')))
      }
    } finally {
      setSavingKey(null)
    }
  }

  // Delete an already-persisted row after the confirm dialog; an unsaved new
  // row is simply dropped locally without a server call.
  const confirmDelete = async () => {
    const key = confirmKey
    setConfirmKey(null)
    if (key == null) return
    const row = rows.find((r) => r.key === key)
    if (!row) return
    if (row.id == null) {
      setRows((prev) => prev.filter((r) => r.key !== key))
      return
    }
    try {
      await deleteMapping(connector, row.id)
      setRows((prev) => prev.filter((r) => r.key !== key))
      setSaved((prev) => {
        const next = { ...prev }
        delete next[String(row.id)]
        return next
      })
    } catch (err) {
      notifyError(extractApiError(err, t('integrations.mappings.deleteError')))
    }
  }

  // A row is only savable with real content — an empty POST can never succeed
  // (§3: no fake affordances; verify finding, confirmed by executed test).
  const canSave = (row: EditRow) => row.koios_value.trim() !== '' && row.external_value.trim() !== ''

  const isDirty = (row: EditRow) => {
    if (row.id == null) return true
    const original = saved[String(row.id)]
    if (!original) return true
    return original.koios_value !== row.koios_value || original.external_value !== row.external_value || original.is_default !== row.is_default
  }

  const domainTabs = domains.map((d) => ({ id: d, label: t(`integrations.mappings.domains.${d}`, { defaultValue: d }) }))

  return (
    <div style={{ maxWidth: 720 }}>
      <SubTabBar tabs={domainTabs} active={domain} onChange={setDomain} />
      <PageTitle>{t('integrations.mappings.title')}</PageTitle>
      <Caption as="p" style={{ marginTop: 2, marginBottom: 16 }}>{t('integrations.mappings.subtitle')}</Caption>

      {loading ? (
        <Caption as="p">{t('common.loadingShort')}</Caption>
      ) : error ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Caption as="p" style={{ color: 'var(--color-danger-text)' }}>{t('integrations.mappings.loadError')}</Caption>
          <Button variant="secondary" onClick={() => setReloadTick((n) => n + 1)}>{t('common:error.retry')}</Button>
        </div>
      ) : rows.length === 0 ? (
        <Caption as="p" style={{ marginBottom: 16 }}>{t('integrations.mappings.empty')}</Caption>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {rows.map((row) => (
            <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto', gap: 8, alignItems: 'center' }}>
              <input aria-label={t('integrations.mappings.koiosValue')} value={row.koios_value}
                onChange={(e) => setRow(row.key, { koios_value: e.target.value })} style={fieldInputStyle} />
              <input aria-label={t('integrations.mappings.externalValue')} value={row.external_value}
                onChange={(e) => setRow(row.key, { external_value: e.target.value })} style={fieldInputStyle} />
              <Toggle checked={row.is_default} onChange={(v) => setRow(row.key, { is_default: v })} ariaLabel={t('integrations.mappings.isDefault')} />
              <SaveButton iconOnly aria-label={t('common:save')} size="sm" saved={!isDirty(row) && row.id != null}
                disabled={savingKey === row.key || !isDirty(row) || !canSave(row)} onClick={() => saveRow(row)}>
                {savingKey === row.key ? <Spinner size={14} /> : <Check size={14} />}
              </SaveButton>
              <Button iconOnly aria-label={t('common:delete')} variant="dangerSoft" size="sm" onClick={() => setConfirmKey(row.key)}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (
        <Button variant="secondary" onClick={addRow}>
          <Plus size={14} />
          {t('integrations.mappings.add')}
        </Button>
      )}

      <ConfirmDialog open={confirmKey != null} danger message={t('integrations.mappings.deleteConfirm')}
        confirmLabel={t('common:delete')} cancelLabel={t('common:cancel')}
        onConfirm={confirmDelete} onCancel={() => setConfirmKey(null)} />
    </div>
  )
}
