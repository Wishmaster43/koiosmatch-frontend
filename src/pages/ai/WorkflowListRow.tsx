/**
 * WorkflowListRow — one Make.com-style scenario row: an overlapping step-icon
 * stack (the module registry's icon/colour, so it matches the canvas), a name +
 * a muted meta line built only from real API fields (last run, folder, updated
 * date), and — on the right — a trigger indicator, the active/draft toggle and
 * the "…" menu. The whole row opens the editor (AW-list); interactive children
 * stop propagation so they don't also fire the row click.
 */
import type { MouseEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ArchiveRestore, CheckCircle, Clock, HelpCircle, MoreHorizontal, MousePointerClick, Play, Trash2, Webhook, Zap, Bell } from 'lucide-react'
import { interactive } from '@/lib/a11y'
import { useDateFormat } from '@/lib/datetime'
import { useSeedLabel } from '@/lib/useSeedLabel'
import { useWorkflowRowState, type WorkflowRowLifecycleProps } from './hooks/useWorkflowRowState'
import { buildTrashNote } from '@/hooks/useTrashFlow'
import { MODULE_META } from '@/modules/index'
import { triggerKeyForType } from './data/workflowTrigger'
import Toggle from '@/components/ui/Toggle'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import SoftChip from '@/components/ui/SoftChip'
import { SectionTitle } from '@/components/ui/typography'
import type { WorkflowStep } from '@/types/workflow'

// One workflow row's props — the shared lifecycle shape (mirrors WorkflowCard),
// plus the status toggle and the folder name already resolved by the parent page.
interface WorkflowListRowProps extends WorkflowRowLifecycleProps {
  folderName?: string
  onToggleStatus: () => void
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
        // No-hex fallback: a missing registry entry falls back to the muted text token,
        // not a hand-picked hex — the whole module registry itself uses tokens only.
        return <StepBubble key={step.id ?? i} Icon={Icon} color={meta?.color ?? 'var(--text-muted)'} bg={meta?.bg ?? 'var(--hover-bg)'} offset={i} title={label} />
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
  const key = triggerKeyForType(triggerType)
  if (key === 'list.triggerScheduled') return { Icon: Clock, key }
  if (key === 'list.triggerWebhook') return { Icon: Webhook, key }
  if (key === 'list.triggerEvent') return { Icon: Bell, key }
  return { Icon: MousePointerClick, key }
}

// One row in the workflow list: status/trigger badges plus its run/edit/archive/restore actions, gated on canManageFolders where relevant.
export default function WorkflowListRow({ workflow, folderName, onRun, canRun = true, onEdit, onToggleStatus, canManageFolders, onArchive, onRestore, onMarkDeletion, onUnmark, graceDays = null }: WorkflowListRowProps) {
  const { t } = useTranslation('workflows')
  const { formatDate, formatDateTime } = useDateFormat()
  const seedLabel = useSeedLabel()
  const { running, setRunning, restoring, setRestoring, hover, setHover } = useWorkflowRowState()
  const active = workflow.status === 'active'
  const archived = Boolean(workflow.archived)
  // TRASH-OVERAL-2: trashed rows swap restore/mark for the erase note + unmark.
  const inTrash = workflow.lifecycle === 'pending_erase'
  const trig = triggerMeta(workflow.trigger_type)
  // LOOKUP-I18N-1: a workflow that still carries its seeded Dutch name renders in the
  // user language; a tenant rename/creation stays exactly as typed.
  const displayName = seedLabel('workflowNames', { label: workflow.name ?? null })

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
  // K-254: existing-target call-graph counters — never a noisy "0" (§SCHERMWAARHEID).
  const calls = workflow.relations_summary?.calls ?? 0
  const calledBy = workflow.relations_summary?.called_by ?? 0
  if (calls > 0) metaParts.push(t('list.relationsCalls', { count: calls }))
  if (calledBy > 0) metaParts.push(t('list.relationsCalledBy', { count: calledBy }))

  // Run stays a distinct action (stopPropagation) even though the row opens the editor.
  const handleRun = async (e: MouseEvent) => {
    e.stopPropagation()
    setRunning(true)
    // The hook's onRun now notifies + refetches the list on success (LIST-FRESH-1)
    // and toasts on failure — no fixed cosmetic delay needed to "feel" done.
    try {
      await onRun(workflow.id)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div {...interactive(onEdit)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="flex items-center gap-3 px-4 py-3"
      style={{ background: hover ? 'var(--hover-bg)' : 'var(--surface)', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
    >
      <StepIconStack steps={workflow.steps} />

      <div className="min-w-0 flex-1">
        <SectionTitle as="div" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</SectionTitle>
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
            <span className="text-xs flex-shrink-0 truncate" style={{ color: 'var(--color-danger-text)', maxWidth: 320 }}>
              {buildTrashNote(t, formatDate, workflow.pending_erase_at, graceDays)}
            </span>
          )}

          {/* Archived soft chip (§4 tint via lib/tint) — read-only, no run/toggle for a deleted workflow */}
          <div className="flex-shrink-0">
            <SoftChip round label={t('list.archivedBadge')} color="var(--color-danger)" />
          </div>

          {/* Restore — settings.update-gated (mirrors deleteFolder's guard); the
              trashed row unmarks first (below) instead of restoring straight to active. */}
          {!inTrash && canManageFolders && onRestore && (
            // Restore is a "gelukt/afronden" action — the house success variant (§4).
            <Button variant="success" onClick={handleRestoreClick} disabled={restoring} style={{ flexShrink: 0 }}
              aria-label={t('list.restoreWorkflow')} title={t('list.restoreWorkflow')}
            >
              {restoring ? <Spinner size={11} /> : <ArchiveRestore size={11} />}
              {t('list.restore')}
            </Button>
          )}

          {/* TRASH-OVERAL-2: archived → trash (workflows.delete-gated at the page;
              the shared preview modal confirms). bin=dangerSoft per the row idiom. */}
          {!inTrash && onMarkDeletion && (
            <Button variant="dangerSoft" iconOnly style={{ flexShrink: 0 }}
              onClick={e => { e.stopPropagation(); onMarkDeletion() }}
              aria-label={t('common:trash.markAction')} title={t('common:trash.markAction')}
            >
              <Trash2 size={13} />
            </Button>
          )}

          {/* TRASH-OVERAL-2: trash → back to plain archived (settings.update-gated).
              No standing variant reproduces the archive tint; secondary is the
              closest sanctioned identity (necessity deviation, noted). */}
          {inTrash && onUnmark && (
            <Button variant="secondary" style={{ flexShrink: 0 }} onClick={e => { e.stopPropagation(); onUnmark() }}
              aria-label={t('common:trash.unmarkAction')} title={t('common:trash.unmarkAction')}
            >
              <ArchiveRestore size={11} />
              {t('common:trash.unmarkAction')}
            </Button>
          )}
        </>
      ) : (
        <>
          {/* Run is this row's primary action — the solid house accent (also fixes the
              ink-twin: this used to read raw --color-primary on a tinted bg, unlike
              WorkflowCard's already-correct --color-primary-text). */}
          <Button variant="soft" onClick={handleRun} disabled={running || !canRun} style={{ flexShrink: 0 }}
            title={canRun ? undefined : t('page.runNoPermission')}>
            {running ? <Spinner size={11} /> : <Play size={11} />}
            {running ? t('page.running') : t('page.run')}
          </Button>

          {/* Active/draft toggle — same semantics as the editor's status switch (active <-> inactive). */}
          <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
            {/* §4 names the ACTIVE WORKFLOW TOGGLE as a success surface — the shared Toggle
              carries that via tone, so house law and house component agree. */}
          <Toggle tone="success" checked={active} onChange={() => onToggleStatus()}
              ariaLabel={t(active ? 'list.setInactive' : 'list.setActive')}
              title={t(active ? 'list.setInactive' : 'list.setActive')} />
          </div>

          {/* Archive (soft-delete) — settings.update-gated, opens the confirm with the
              open-runs notice. Not destructive (§4 danger-sweep exclusion): secondary
              chrome + archive ink. */}
          {canManageFolders && onArchive && (
            <Button variant="secondary" iconOnly style={{ flexShrink: 0, color: 'var(--color-archive)' }}
              onClick={e => { e.stopPropagation(); onArchive() }}
              aria-label={t('list.archiveWorkflow')} title={t('list.archiveWorkflow')}
            >
              <Trash2 size={13} />
            </Button>
          )}

          {/* "…" menu — today: same action as the row click (edit) */}
          <Button variant="secondary" iconOnly style={{ flexShrink: 0 }}
            onClick={e => { e.stopPropagation(); onEdit() }}
            aria-label={t('list.editWorkflow')} title={t('list.editWorkflow')}
          >
            <MoreHorizontal size={13} />
          </Button>
        </>
      )}
    </div>
  )
}
