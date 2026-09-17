/**
 * KpiEntityPanel — one entity tab of the KPI-builder: the tenant's own KPI
 * definitions for that entity, reorderable (drag + keyboard), each row
 * toggle/edit/delete-with-undo, gated on `settings.update` (every write
 * control stays visible but disabled — §3 no fake affordance, never hidden).
 * The add button also gates on the per-entity (12) and tenant-wide (40) caps
 * — an honest FE counter mirroring the backend's own guard (§10).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useConfirm } from '@/hooks/useConfirm'
import { useNumberFormat } from '@/lib/formatters'
import ErrorBanner from '@/components/ui/ErrorBanner'
import CalloutBox from '@/components/ui/CalloutBox'
import Button from '@/components/ui/Button'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { Caption } from '@/components/ui/typography'
import { DragList } from '@/pages/settings/components/SettingsControls'
import { useKpiDefinitions, useKpiDefinitionTotal } from './useKpiDefinitions'
import { useKpiDefinitionMutations } from './useKpiDefinitionMutations'
import { KPI_CAP_PER_ENTITY, KPI_CAP_PER_TENANT } from './kpiDefinitionsApi'
import KpiDefinitionRow from './KpiDefinitionRow'
import KpiDefinitionForm from './KpiDefinitionForm'
import type { KpiDefinition, KpiDefinitionCreate, KpiDefinitionPatch, KpiEntity, KpiEntityRegistry } from './kpiDefinitionsApi'

interface KpiEntityPanelProps {
  entity: KpiEntity
  registry: KpiEntityRegistry
}

export default function KpiEntityPanel({ entity, registry }: KpiEntityPanelProps) {
  const { t } = useTranslation(['settings', 'common'])
  const auth = useAuth()
  const canEdit = !!auth?.hasPermission('settings.update')
  const { formatNumber } = useNumberFormat()
  const { confirm, dialog } = useConfirm()

  const { data: rows = [], isLoading, isError, refetch } = useKpiDefinitions(entity)
  const { data: totalActive = 0 } = useKpiDefinitionTotal()
  const { create, patch, remove, restore, reorder } = useKpiDefinitionMutations(entity, t)

  // showForm holds the row being edited, or `true` for a fresh "add" draft.
  const [showForm, setShowForm] = useState<KpiDefinition | true | null>(null)
  // Last deleted row, kept for the session-only undo (§10 R3: no `trashed` list route).
  const [justDeleted, setJustDeleted] = useState<KpiDefinition | null>(null)

  // GET failure: no list, no add — a retryable ErrorBanner is the whole panel (§3 four states).
  if (isError) {
    return <ErrorBanner onRetry={() => { void refetch() }}>{t('kpiBuilder.loadError')}</ErrorBanner>
  }

  const entityActiveCount = rows.filter(r => r.active).length
  const atEntityCap = entityActiveCount >= KPI_CAP_PER_ENTITY
  const atTenantCap = totalActive >= KPI_CAP_PER_TENANT
  const addDisabled = !canEdit || atEntityCap || atTenantCap
  const editing = showForm && showForm !== true ? showForm : null

  // Create posts the full body; edit posts only the changed keys (KpiDefinitionForm decides which).
  const handleSubmit = (body: KpiDefinitionCreate | KpiDefinitionPatch) => {
    if (editing) {
      patch.mutate({ id: editing.id, body: body as KpiDefinitionPatch }, { onSuccess: () => setShowForm(null) })
    } else {
      create.mutate(body as KpiDefinitionCreate, { onSuccess: () => setShowForm(null) })
    }
  }

  // Danger-confirm delete, then stage the row for the undo notice below.
  const handleDelete = (row: KpiDefinition) => {
    const name = row.label ?? row.computed?.metric_label ?? row.metric_key
    confirm(t('kpiBuilder.confirmDelete', { name }), () => {
      remove.mutate(row.id, { onSuccess: () => setJustDeleted(row) })
    }, { danger: true })
  }

  const handleRestore = () => {
    if (!justDeleted) return
    restore.mutate(justDeleted.id, { onSuccess: () => setJustDeleted(null) })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Caption>{t('kpiBuilder.count.entity', { count: formatNumber(entityActiveCount), max: formatNumber(KPI_CAP_PER_ENTITY) })}</Caption>
          <Caption>{t('kpiBuilder.count.tenant', { count: formatNumber(totalActive), max: formatNumber(KPI_CAP_PER_TENANT) })}</Caption>
        </div>
        <DrawerAddButton onClick={() => setShowForm(true)} label={t('kpiBuilder.addBtn')} disabled={addDisabled}
          title={canEdit ? undefined : t('kpiBuilder.noPermission')}
          ariaDescription={canEdit ? undefined : t('kpiBuilder.noPermission')} />
      </div>
      {(atEntityCap || atTenantCap) && (
        <CalloutBox variant="warning">{t('kpiBuilder.capReached', { max: atTenantCap ? KPI_CAP_PER_TENANT : KPI_CAP_PER_ENTITY })}</CalloutBox>
      )}
      {isLoading && <Caption as="div">{t('kpiBuilder.loading')}</Caption>}
      {!isLoading && rows.length === 0 && <Caption as="div">{t('kpiBuilder.empty')}</Caption>}
      {!isLoading && rows.length > 0 && (
        <DragList
          items={rows}
          sortable={canEdit}
          onReorder={next => reorder.mutate(next.map(row => row.id))}
          renderItem={(row: KpiDefinition) => (
            <KpiDefinitionRow row={row} canEdit={canEdit} onToggleActive={(id, active) => patch.mutate({ id, body: { active } })}
              onEdit={r => setShowForm(r)} onDelete={handleDelete} />
          )}
        />
      )}
      {justDeleted && (
        <CalloutBox variant="info">
          {t('kpiBuilder.deletedUndo', { name: justDeleted.label ?? justDeleted.computed?.metric_label ?? justDeleted.metric_key })}
          {' '}
          <Button variant="ghost" size="sm" onClick={handleRestore}>{t('kpiBuilder.restoreBtn')}</Button>
        </CalloutBox>
      )}
      {showForm && (
        <KpiDefinitionForm entity={entity} registry={registry} editing={editing}
          saving={create.isPending || patch.isPending} onSubmit={handleSubmit} onClose={() => setShowForm(null)} />
      )}
      {dialog}
    </div>
  )
}
