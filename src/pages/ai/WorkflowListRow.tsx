/**
 * WorkflowListRow — one Make.com-style scenario row: an overlapping step-icon
 * stack (the module registry's icon/colour, so it matches the canvas), a name +
 * a muted meta line built only from real API fields (last run, folder, updated
 * date), and — on the right — a trigger indicator, the active/draft toggle and
 * the "…" menu. The whole row opens the editor (AW-list); interactive children
 * stop propagation so they don't also fire the row click.
 */
import { useState } from 'react'
import type { MouseEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ArchiveRestore, CheckCircle, Clock, HelpCircle, MoreHorizontal, MousePointerClick, Play, Trash2, Webhook, Zap, Bell } from 'lucide-react'
import { interactive } from '@/lib/a11y'
import { useDateFormat } from '@/lib/datetime'
import { buildTrashNote } from '@/hooks/useTrashFlow'
import { MODULE_META } from '@/modules/index'
import Toggle from '@/components/ui/Toggle'
import Spinner from '@/components/ui/Spinner'
import type { Workflow, WorkflowStep } from '@/types/workflow'

// One workflow row's props — mirrors WorkflowCard's shared shape, plus the
// status toggle and the folder name already resolved by the parent page.
interface WorkflowListRowProps {
  workflow: Workflow
  folderName?: string
  onRun: (id?: string | number) => void | Promise<void>
  onEdit: () => void
  onToggleStatus: () => void
  // Archive/restore lifecycle (TRASH-OVERAL-1b) — both settings.update-gated.
  canManageFolders?: boolean
  onArchive?: () => void
  onRestore?: () => void | Promise<void>
  // TRASH-OVERAL-2: mark for erasure (workflows.delete) shows on an archived row;
  // unmark (settings.update) shows on a trashed row. Absent prop = hidden (§7).
  onMarkDeletion?: () => void
  onUnmark?: () => void | Promise<void>
  // Tenant grace window — feeds the trashed row's erase note (DD-MM-YYYY).
  graceDays?: number | null
}

const BUBBLE_SIZE = 24
const STACK_SLOTS = 3

// One round module-icon bubble in the overlapping stack.
function StepBubble({ Icon, color, bg, offset, title }: { Icon: LucideIcon; color: string; bg: string; offset: number; title?: string }) {
  return (
    <div title={title} style={{
      width: BUBBLE_SIZE, height: BUBBLE_SIZE, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: bg, border: '2px solid var(--surface)',
      marginLeft: offset === 0 ? 0 : -8, position: 'relative', zIndex: STACK_SLOTS - offset,
    }}>
      <Icon size={12} color={color} />
    </div>
  )
}

// Up to 3 overlapping step icons (registry icon/colour, same as the canvas
// nodes) + a "+N" bubble for the rest — a peek at what the workflow does.
function StepIconStack({ steps }: { steps: WorkflowStep[] }) {
  const { t } = useTranslation('workflows')
  if (steps.length === 0) {
    return <StepBubble Icon={Zap} color="var(--color-primary)" bg="var(--color-primary-bg)" offset={0} />
  }
  const overflow = steps.length > STACK_SLOTS
  const visible = overflow ? steps.slice(0, STACK_SLOTS - 1) : steps.slice(0, STACK_SLOTS)
  const extra = steps.length - visible.length
  return (
    <div className="flex items-center flex-shrink-0">
      {visible.map((step, i) => {
        const meta = step.type ? MODULE_META[step.type] : undefined
        const Icon = (meta?.Icon ?? HelpCircle) as unknown as LucideIcon
        const label = t(`modules.${step.type}`, { defaultValue: meta?.label ?? step.type })
        // eslint-disable-next-line no-restricted-syntax -- DATA: fallback mirrors the module registry's own colour when a step type is missing from it, not UI styling
        return <StepBubble key={step.id ?? i} Icon={Icon} color={meta?.color ?? '#64748B'} bg={meta?.bg ?? 'var(--hover-bg)'} offset={i} title={label} />
      })}
      {extra > 0 && (
        <div style={{
          width: BUBBLE_SIZE, height: BUBBLE_SIZE, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--hover-bg)', border: '2px solid var(--surface)',
          marginLeft: -8, fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
        }}>
          {t('list.moreSteps', { n: extra })}
        </div>
      )}
    </div>
  )
}

// Workflow-level trigger → icon + i18n key (not a module — the workflow's own
// start condition): a clock for a schedule, a webhook glyph for an inbound
// hook, a pointer for manual/on-demand.
function triggerMeta(triggerType?: string): { Icon: LucideIcon; key: string } {
  if (triggerType === 'scheduled') return { Icon: Clock, key: 'list.triggerScheduled' }
  if (triggerType === 'webhook') return { Icon: Webhook, key: 'list.triggerWebhook' }
  if (triggerType === 'event') return { Icon: Bell, key: 'list.triggerEvent' }
  return { Icon: MousePointerClick, key: 'list.triggerManual' }
}

export default function WorkflowListRow({ workflow, folderName, onRun, onEdit, onToggleStatus, canManageFolders, onArchive, onRestore, onMarkDeletion, onUnmark, graceDays = null }: WorkflowListRowProps) {
  const { t } = useTranslation('workflows')
  const { formatDate, formatDateTime } = useDateFormat()
  const [running, setRunning] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [hover, setHover] = useState(false)
  const active = workflow.status === 'active'
  const archived = Boolean(workflow.archived)
  // TRASH-OVERAL-2: trashed rows swap restore/mark for the erase note + unmark.
  const inTrash = workflow.lifecycle === 'pending_erase'
  const trig = triggerMeta(workflow.trigger_type)

  // Restore is a distinct async action — keep the row responsive while it lands.
  const handleRestoreClick = async (e: MouseEvent) => {
    e.stopPropagation()
    if (!onRestore) return
    setRestoring(true)
    await onRestore()
    setRestoring(false)
  }

  // Meta line — real fields only (never invented): last run time, folder, updated date.
  const metaParts: string[] = []
  metaParts.push(workflow.last_run ? formatDateTime(workflow.last_run.time) : t('page.notRun'))
  if (folderName) metaParts.push(folderName)
  if (workflow.updated_at) metaParts.push(t('list.updated', { date: formatDateTime(workflow.updated_at) }))

  // Run stays a distinct action (stopPropagation) even though the row opens the editor.
  const handleRun = async (e: MouseEvent) => {
    e.stopPropagation()
    setRunning(true)
    await onRun(workflow.id)
    setTimeout(() => setRunning(false), 2000)
  }

  return (
    <div {...interactive(onEdit)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="flex items-center gap-3 px-4 py-3"
      style={{ background: hover ? 'var(--hover-bg)' : 'var(--surface)', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
    >
      <StepIconStack steps={workflow.steps} />

      <div className="min-w-0 flex-1">
        <div className="font-semibold text-[var(--text)] truncate" style={{ fontSize: 13 }}>{workflow.name}</div>
        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] truncate">
          {workflow.last_run && (workflow.last_run.ok
            ? <CheckCircle size={11} color="var(--color-success)" className="flex-shrink-0" />
            : <AlertCircle size={11} color="var(--color-danger)" className="flex-shrink-0" />)}
          <span className="truncate">{metaParts.join(' · ')}</span>
        </div>
      </div>

      {/* Trigger indicator — role="img" so the aria-label is actually exposed (a bare div isn't) */}
      <div role="img" title={t(trig.key)} aria-label={t(trig.key)}
        className="flex items-center justify-center flex-shrink-0" style={{ width: 20, color: 'var(--text-muted)' }}>
        <trig.Icon size={15} />
      </div>

      {archived ? (
        <>
          {/* TRASH-OVERAL-2: the trashed row says when it entered the trash and when
              it erases for good (DD-MM-YYYY via the house formatter). */}
          {inTrash && (
            <span className="text-xs flex-shrink-0 truncate" style={{ color: 'var(--color-danger)', maxWidth: 320 }}>
              {buildTrashNote(t, formatDate, workflow.pending_erase_at, graceDays)}
            </span>
          )}

          {/* Archived soft chip (§4 soft-chip convention) — read-only, no run/toggle for a deleted workflow */}
          <span className="flex-shrink-0 rounded-full px-2 py-1" style={{
            fontSize: 11, fontWeight: 600, color: 'var(--color-danger)',
            background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)',
          }}>
            {t('list.archivedBadge')}
          </span>

          {/* Restore — settings.update-gated (mirrors deleteFolder's guard); the
              trashed row unmarks first (below) instead of restoring straight to active. */}
          {!inTrash && canManageFolders && onRestore && (
            <button onClick={handleRestoreClick} disabled={restoring}
              aria-label={t('list.restoreWorkflow')} title={t('list.restoreWorkflow')}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium flex-shrink-0"
              style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid var(--color-success)', cursor: restoring ? 'not-allowed' : 'pointer' }}
            >
              {restoring ? <Spinner size={11} /> : <ArchiveRestore size={11} />}
              {t('list.restore')}
            </button>
          )}

          {/* TRASH-OVERAL-2: archived → trash (workflows.delete-gated at the page;
              the shared preview modal confirms). */}
          {!inTrash && onMarkDeletion && (
            <button onClick={e => { e.stopPropagation(); onMarkDeletion() }}
              aria-label={t('common:trash.markAction')} title={t('common:trash.markAction')}
              className="flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ width: 26, height: 26, background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', cursor: 'pointer', color: 'var(--color-danger)' }}
            >
              <Trash2 size={13} />
            </button>
          )}

          {/* TRASH-OVERAL-2: trash → back to plain archived (settings.update-gated). */}
          {inTrash && onUnmark && (
            <button onClick={e => { e.stopPropagation(); onUnmark() }}
              aria-label={t('common:trash.unmarkAction')} title={t('common:trash.unmarkAction')}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--color-archive) 10%, transparent)', color: 'var(--color-archive)',
                border: '1px solid color-mix(in srgb, var(--color-archive) 40%, transparent)', cursor: 'pointer' }}
            >
              <ArchiveRestore size={11} />
              {t('common:trash.unmarkAction')}
            </button>
          )}
        </>
      ) : (
        <>
          {/* Run */}
          <button onClick={handleRun} disabled={running}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium flex-shrink-0"
            style={{ background: running ? 'var(--border)' : 'var(--color-primary-bg)', color: running ? 'var(--text-muted)' : 'var(--color-primary)', border: 'none', cursor: running ? 'not-allowed' : 'pointer' }}
          >
            {running ? <Spinner size={11} /> : <Play size={11} />}
            {running ? t('page.running') : t('page.run')}
          </button>

          {/* Active/draft toggle — same semantics as the editor's status switch (active <-> inactive).
              On-colour unified to primary (HUISSTIJL-1); was success — flag for Danny if workflows must stay green. */}
          <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
            {/* §4 names the ACTIVE WORKFLOW TOGGLE as a success surface — the shared Toggle
              carries that via tone, so house law and house component agree. */}
          <Toggle tone="success" checked={active} onChange={() => onToggleStatus()}
              ariaLabel={t(active ? 'list.setInactive' : 'list.setActive')}
              title={t(active ? 'list.setInactive' : 'list.setActive')} />
          </div>

          {/* Archive (soft-delete) — settings.update-gated, opens the confirm with the open-runs notice */}
          {canManageFolders && onArchive && (
            <button onClick={e => { e.stopPropagation(); onArchive() }}
              aria-label={t('list.archiveWorkflow')} title={t('list.archiveWorkflow')}
              className="flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ width: 26, height: 26, background: 'var(--hover-bg)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <Trash2 size={13} />
            </button>
          )}

          {/* "…" menu — today: same action as the row click (edit) */}
          <button onClick={e => { e.stopPropagation(); onEdit() }}
            aria-label={t('list.editWorkflow')} title={t('list.editWorkflow')}
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: 26, height: 26, background: 'var(--hover-bg)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <MoreHorizontal size={13} />
          </button>
        </>
      )}
    </div>
  )
}
