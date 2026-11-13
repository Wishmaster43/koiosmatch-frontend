/**
 * IntegrationLinksTable (MAPPING-TABLE-FE-1) — presentational table of the link rows:
 * type, record (drill-down link), editable external id with a row-level save,
 * status pill, error, linked and updated stamps. Editing needs `canEdit`
 * (settings.update); without it the id is read-only text (no fake affordance).
 */
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import StatusPill from '@/components/ui/StatusPill'
import SaveButton from '@/components/ui/SaveButton'
import Spinner from '@/components/ui/Spinner'
import { Caption } from '@/components/ui/typography'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { useDateFormat } from '@/lib/datetime'
import EntityLink from '@/components/ui/EntityLink'
import { LINK_TARGET_PAGE } from './linkTargets'
import type { LinkRow } from './linksApi'

interface Props {
  rows: LinkRow[]
  loading: boolean
  canEdit: boolean
  onSave: (row: LinkRow, externalId: string | null) => Promise<void>
}

// Stable row key: one record can hold a link per system.
const rowKey = (r: LinkRow) => `${r.entity_type}:${r.entity_id}:${r.system}`

// Status -> house colour token (linked success, failed danger, unlinked muted).
const STATUS_COLOR: Record<string, string> = {
  linked: 'var(--color-success)', pending: 'var(--color-warning)', syncing: 'var(--color-info)', failed: 'var(--color-danger)', unlinked: 'var(--text-muted)',
}

export default function IntegrationLinksTable({ rows, loading, canEdit, onSave }: Props) {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useDateFormat()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)

  // Saves one row; an emptied value clears the link (null). Draft resets on success.
  const save = useCallback(async (row: LinkRow) => {
    const key = rowKey(row)
    setSavingKey(key)
    try {
      const value = (drafts[key] ?? '').trim()
      await onSave(row, value === '' ? null : value)
      setDrafts((prev) => { const next = { ...prev }; delete next[key]; return next })
    } catch {
      // The container surfaces the error toast; the draft stays so the user can retry.
    } finally {
      setSavingKey(null)
    }
  }, [drafts, onSave])

  // Column set: rebuilt only when drafts, saving state or permission change.
  const columns = useMemo<Column<LinkRow>[]>(() => [
    { key: 'entity_type', header: t('integrations.links.columns.type'), nowrap: true,
      render: (r) => t(`integrations.links.types.${r.entity_type}`) },
    { key: 'label', header: t('integrations.links.columns.record'),
      render: (r) => {
        if (r.label == null) return <Caption>{t('integrations.links.deleted')}</Caption>
        const page = LINK_TARGET_PAGE[r.entity_type]
        return page ? <EntityLink page={page} id={r.entity_id}>{r.label}</EntityLink> : r.label
      } },
    { key: 'external_id', header: t('integrations.links.columns.externalId'),
      render: (r) => {
        if (!canEdit) return r.external_id ?? '—'
        const key = rowKey(r)
        const value = drafts[key] ?? r.external_id ?? ''
        const dirty = value.trim() !== (r.external_id ?? '')
        return (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input maxLength={255} aria-label={t('integrations.links.columns.externalId')} value={value} style={{ ...fieldInputStyle, width: 180 }}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))} />
            <SaveButton iconOnly aria-label={t('common:save')} size="sm" saved={!dirty}
              disabled={!dirty || savingKey === key} onClick={() => save(r)}>
              {savingKey === key ? <Spinner size={14} /> : <Check size={14} />}
            </SaveButton>
          </div>
        )
      } },
    { key: 'status', header: t('integrations.links.columns.status'), nowrap: true,
      render: (r) => {
        // The stored status wins (a failed or pending row usually has no id yet); without one, an id reads as
        // linked and a blank id as unlinked (screen probe 13-11: the Mislukt filter returned a 'Niet gekoppeld' chip).
        const s = r.status ?? (r.external_id ? 'linked' : 'unlinked')
        return <StatusPill label={t(`integrations.links.status.${s}`)} color={STATUS_COLOR[s]} />
      } },
    { key: 'error', header: t('integrations.links.columns.error'),
      render: (r) => (r.error ? <Caption title={r.error}>{r.error}</Caption> : null) },
    { key: 'linked_at', header: t('integrations.links.columns.linked'),
      render: (r) => (r.linked_at ? `${formatDateTime(r.linked_at)}${r.linked_by_name ? ` · ${r.linked_by_name}` : ''}` : '—') },
    { key: 'updated_at', header: t('integrations.links.columns.updated'), nowrap: true,
      render: (r) => formatDateTime(r.updated_at) },
  ], [t, canEdit, drafts, savingKey, formatDateTime, save])

  return (
    <DataTable columns={columns} rows={rows} getRowId={rowKey} loading={loading}
      loadingText={t('common.loadingShort')} emptyText={t('integrations.links.empty')} />
  )
}
