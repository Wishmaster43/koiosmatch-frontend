/**
 * SubtaskQuickView — TAKEN 3 (walkthrough 21-08, Danny's decision "eigen
 * compacte pop-up"): clicking a subtask row opens THIS compact popup instead of
 * the full TaskDrawer. Shell mirrors ChangelogPopover's modeless FloatingPanel
 * pattern (overlay={false}, own outside-click close, Esc/focus-trap owned by the
 * panel itself) — never a bespoke dialog. Content is deliberately thin: a status
 * picker (the same tenant vocabulary + PATCH route the full drawer uses), a
 * read-only assignee/due and the description, plus an escape hatch to open the
 * full drawer for anything this view doesn't cover.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Button from '@/components/ui/Button'
import CreatableSelect from '@/components/ui/CreatableSelect'
import SafeHtml from '@/components/ui/SafeHtml'
import Spinner from '@/components/ui/Spinner'
import { PageTitle, Caption } from '@/components/ui/typography'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import { FieldRow } from '@/components/forms/fields'
// PORTAL-MARKER-1: a click inside an open portalled picker menu (the status
// CreatableSelect below) is never "outside" — mirrors ChangelogPopover.
import { isInsideDropdownPortal } from '@/lib/useDropdownPlacement'
import { useNavigation } from '@/context/NavigationContext'
import { useTaskLookups } from '@/context/TaskLookupsContext'
import { useTaskLookupIds } from '../hooks/useTaskLookupIds'
import { useDateFormat } from '@/lib/datetime'
import { mapTaskDetail } from '../data/mapTask'
import type { TaskDetail } from '@/types/task'
import type { Id } from '@/types/common'

// One read-mode row: muted label left, value right (mirrors DetailsTab's Row).
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
      <span style={CANON_LABEL_STYLE}>{label}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  )
}

export default function SubtaskQuickView({ id, onClose, onChanged }: {
  id: Id
  onClose: () => void
  // Lets the host list (SubtasksSection) refetch after a status change.
  onChanged?: () => void
}) {
  const { t } = useTranslation('tasks')
  const { openEntity } = useNavigation()
  const { statuses } = useTaskLookups()
  const { maps: lookupIds } = useTaskLookupIds()
  const { formatDate } = useDateFormat()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  // Freshness guard (§9): a monotonic request id (older responses lose, mirrors
  // SubtasksSection's requestIdRef) plus a dead flag re-armed in effect SETUP —
  // a boolean alone was defeated by the PATCH-failure refetch after unmount.
  const requestRef = useRef(0)
  const deadRef = useRef(false)

  // Lazy GET of the one subtask — the exact fetch + mapper the full drawer's own
  // selectTask (useTaskDrawerActions) uses, so this view never invents a shape.
  const fetchTask = () => {
    if (deadRef.current) return
    const rid = ++requestRef.current
    const fresh = () => !deadRef.current && rid === requestRef.current
    setLoading(true); setError(false)
    api.get(`/tasks/${id}`)
      .then(r => { if (fresh()) setTask(mapTaskDetail(unwrap(r))) })
      .catch(() => { if (fresh()) setError(true) })
      .finally(() => { if (fresh()) setLoading(false) })
  }
  useEffect(() => {
    deadRef.current = false
    fetchTask()
    return () => { deadRef.current = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the id changes
  }, [id])

  // Close on outside click — the panel is MODELESS (overlay=false), so a click
  // on the page behind it must close this view (mirrors ChangelogPopover).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (isInsideDropdownPortal(e.target as Node)) return
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])

  // Persist a status change immediately: resolve the tenant slug to its uuid FK
  // (mirrors useTaskDrawerActions.handleUpdate's status-only branch) and PATCH the
  // SAME route the full drawer uses. An unresolved slug means nothing safe to
  // send — abort with the same "not ready" notice, no optimistic write.
  const changeStatus = (statusKey: string) => {
    const resolved = lookupIds.status[statusKey]
    if (!resolved) { notifyError(t('drawer.lookupNotReady')); return }
    const meta = statuses.find(s => s.value === statusKey)
    setTask(prev => (prev ? { ...prev, statusKey, statusLabel: meta?.label ?? prev.statusLabel, statusColor: meta?.color ?? prev.statusColor } : prev))
    api.patch(`/tasks/${id}`, { status_id: resolved })
      .then(() => onChanged?.())
      .catch(err => { notifyError(extractApiError(err, t('common:actionFailed'))); fetchTask() })
  }

  // Escalate to the full drawer for anything this compact view doesn't cover.
  const openFull = () => { openEntity('tasks', id); onClose() }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'flex' }}>
      <FloatingPanel open onClose={onClose} ariaLabel={task?.title ?? t('details.title')}
        width={600} maxWidth="92vw" overlay={false}
        bodyStyle={{ padding: '12px 14px' }}
        header={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, overflow: 'hidden' }}>
              <PageTitle as="span" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {task?.title ?? t('details.title')}
              </PageTitle>
              {task?.parent && <Caption as="span">{task.parent.title}</Caption>}
            </div>
            <Button variant="secondary" size="sm" onClick={openFull} style={{ marginLeft: 'auto', flexShrink: 0 }}>
              <ExternalLink size={13} /> {t('details.subtasks.openFull')}
            </Button>
          </div>
        )}>
        {/* Four UI states (§3): loading / error+retry / success — never blank. */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 0', justifyContent: 'center' }}>
            <Spinner size={16} /> <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('details.subtasks.loading')}</span>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--color-danger-text)', padding: '8px 0' }}>
            <span>{t('details.subtasks.error')}</span>
            <Button variant="secondary" size="sm" onClick={fetchTask}>{t('common:error.retry')}</Button>
          </div>
        ) : task && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* FieldRow (not Row): the one INTERACTIVE control here must carry a
                programmatic label — FieldRow clones id/aria-labelledby into it (§6). */}
            <FieldRow label={t('details.status')}>
              <CreatableSelect value={String(task.statusKey)} onChange={changeStatus}
                options={statuses.map(s => ({ value: s.value, label: s.label }))} allowCreate={false} />
            </FieldRow>
            <Row label={t('details.assignee')}>
              <span style={{ fontSize: 12, color: task.assignee ? 'var(--text)' : 'var(--text-muted)' }}>
                {task.assignee?.name || t('bureau')}
              </span>
            </Row>
            <Row label={t('details.due')}>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{formatDate(task.due)}</span>
            </Row>
            {task.description && (
              <div style={{ borderRadius: 10, border: '1px solid var(--border)', padding: '9px 12px', marginTop: 4 }}>
                <SafeHtml html={task.description} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
              </div>
            )}
          </div>
        )}
      </FloatingPanel>
    </div>
  )
}
