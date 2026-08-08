/**
 * AssignTargetsBar — G29 (BELLIJST-ASSIGN-1): shown once ≥1 target row is
 * selected. Divides the selection round-robin over N chosen recruiters via
 * POST /outreach-campaigns/{id}/targets/assign, using the SAME shared
 * ActionMenu multi-select node the bulk bars use (§3A — extend, never
 * duplicate). The result is reported honestly: assigned vs. skipped (the
 * backend skips any target id it can't resolve, e.g. a foreign/stale id) —
 * never a bare "done" toast.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import ActionMenu from '@/components/ui/ActionMenu'
import type { MenuNode } from '@/components/ui/ActionMenu'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { AssignResult } from '../hooks/useOutreachDetail'

interface RecruiterOption { value: string; label: string }

export default function AssignTargetsBar({ selectedCount, selectedIds, recruiters, onAssign, onDone }: {
  selectedCount: number
  selectedIds: string[]
  recruiters: RecruiterOption[]
  onAssign: (targetIds: string[], recruiterIds: string[]) => Promise<AssignResult>
  // Clears the row selection once the request settles (success or failure — either
  // way the detail has already re-synced from the server response).
  onDone: () => void
}) {
  const { t } = useTranslation('outreach')
  const [saving, setSaving] = useState(false)

  // Submit handler for the multi-select node's confirm button (ActionMenu's
  // onSubmit type is shared with its single-value input node, hence the union —
  // a multiSelect node always calls back with the array branch). Guards against
  // an empty pick — ActionMenu allows submitting zero selections, which the
  // backend would 422 on (min:1).
  const handleSubmit = async (value: string | Array<string | number>) => {
    const recruiterIds = (Array.isArray(value) ? value : [value]).map(String)
    if (!recruiterIds.length || !selectedIds.length) return
    setSaving(true)
    try {
      const { updated, skipped } = await onAssign(selectedIds, recruiterIds)
      notifySuccess(skipped.length
        ? t('drawer.assign.resultPartial', { updated: updated.length, skipped: skipped.length })
        : t('drawer.assign.resultAll', { count: updated.length }))
    } catch {
      notifyError(t('drawer.assign.failed'))
    } finally {
      setSaving(false)
      onDone()
    }
  }

  const items: MenuNode[] = [
    { key: 'recruiters', label: t('drawer.assign.pickRecruiters'), icon: Users, multiSelect: true,
      options: recruiters, searchPlaceholder: t('drawer.assign.searchRecruiter'),
      emptyText: t('drawer.assign.noRecruiters'),
      submitLabel: t('drawer.assign.confirm'),
      onSubmit: handleSubmit },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '6px 10px', borderRadius: 8, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary-text)' }}>
        {t('drawer.assign.selected', { count: selectedCount })}
      </span>
      <div style={{ marginLeft: 'auto' }}>
        <ActionMenu label={t('drawer.assign.button')} icon={Users} items={items}
          disabled={saving || recruiters.length === 0} menuWidth={240} align="right" />
      </div>
    </div>
  )
}
