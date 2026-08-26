/**
 * SubEntityStatusTitleRow — the drawer title-row's name + reference-number chip +
 * colour-coded status badge with its own inline picker (JOB-STATUS-1). Split out
 * (§0.3 — the >400-line split trigger hit LocationDetail.tsx, 2026-08-03) because
 * DepartmentDetail.tsx (PARITY-DEPARTMENT-1) carried a near-verbatim copy of the
 * exact same block — one shared component now backs both drill-downs instead of
 * two copies that would keep drifting apart.
 *
 * Pure UI: the editing/draft state is fully local — it was never read outside this
 * block in either original file. The only thing that leaves this component is the
 * PATCH call through `onSave`, scoped to `statusId` only. The pager/delete cluster
 * and the general field-table save cycle stay in each container: they are a
 * DIFFERENT concern (DRILL-PAGER-1/SUBENTITEIT-DELETE-1), tagged separately in both
 * originals, and already differ slightly per entity (delete copy, action-cluster
 * gap) — folding them in here would just re-introduce per-entity branching inside
 * a component meant to be identical everywhere.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import CreatableSelect from '@/components/ui/CreatableSelect'
import TitleBadge from '@/components/drawer/TitleBadge'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import Button from '@/components/ui/Button'
import type { Id } from '@/types/common'

export interface SubEntityStatusTitleRowProps {
  /** The entity's own id — travels into the `onSave` PATCH call below. */
  id: Id
  /** Entity name, rendered as the drawer title. */
  name: string
  referenceNumber?: string
  /** Current status value — seeds the picker draft when the pencil opens it. */
  statusId?: Id | null
  statusLabel?: string
  statusColor?: string
  /** Status lookup options for the inline picker (value/label pairs). */
  statusOptions: { value: string; label: string }[]
  /** Fires the same PATCH the field tables use, scoped to statusId only. */
  onSave: (id: Id, payload: { statusId: Id | null }) => void
}

// Shared title-row status badge + inline picker (see the module doc above): editing state is local, only the scoped statusId PATCH leaves this component.
export default function SubEntityStatusTitleRow({
  id, name, referenceNumber, statusId, statusLabel, statusColor, statusOptions, onSave,
}: SubEntityStatusTitleRowProps) {
  const { t } = useTranslation('customers')
  // JOB-STATUS-1: the title-row status badge's own inline edit — pencil toggles to
  // a searchable CreatableSelect + save/cancel (same in-place-edit convention as
  // EditableFieldTable/EditableRichTextField, §3A), independent of the entity's own
  // general-fields save cycle since status lives entirely in the title row.
  const [editingStatus, setEditingStatus] = useState(false)
  const [statusDraft, setStatusDraft] = useState('')
  const startEditStatus = () => { setStatusDraft(statusId != null ? String(statusId) : ''); setEditingStatus(true) }
  const saveStatus = () => { onSave(id, { statusId: statusDraft || null }); setEditingStatus(false) }
  const cancelStatus = () => setEditingStatus(false)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{name}</div>
      <ReferenceNumberChip value={referenceNumber} />
      {editingStatus ? (
        // Inline picker in the title row (Danny 28-07: "Status van locatie moet hier!!",
        // i.e. "The location's status must be here!!") — searchable, pick-only
        // (allowCreate off, same as every tenant-lookup select).
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 170 }}>
            <CreatableSelect value={statusDraft} onChange={setStatusDraft} options={statusOptions}
              placeholder={t('locations.detail.status')} allowCreate={false} menuWidth={180} />
          </div>
          {/* BRAND-TEXT-COLOR-1: readable text on the accent background is the
              dedicated --color-on-accent token (derived from brand luminance),
              not a hardcoded white — Button's primary variant carries this. */}
          <Button variant="primary" iconOnly size="sm" onClick={saveStatus} title={t('common:save')} aria-label={t('common:save')}><Save size={13} /></Button>
          <Button variant="secondary" iconOnly size="sm" onClick={cancelStatus} title={t('common:cancel')} aria-label={t('common:cancel')}><X size={13} /></Button>
        </div>
      ) : (
        <>
          {/* Status = colour-coded read-only badge next to the title (§3A(c)), not
              buried as a row in the field table — the pencil reopens the picker above. */}
          <TitleBadge label={statusLabel} color={statusColor} />
          <Button variant="secondary" iconOnly size="sm" onClick={startEditStatus} title={t('locations.detail.changeStatus')} aria-label={t('locations.detail.changeStatus')}><Edit2 size={13} /></Button>
        </>
      )}
    </div>
  )
}
