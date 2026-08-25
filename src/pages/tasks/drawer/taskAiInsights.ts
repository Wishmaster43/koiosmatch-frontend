// taskAiInsights — pure FE Koios heuristic insights for the task drawer (deadline
// health, assignment, link count). See buildTaskAdviceInsights below for the detail.
import { isTaskOverdue, dueDateTime } from '../data/mapTask'
import type { TaskDetail } from '@/types/task'
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'

// A bound-namespace translate function (the caller already resolved the namespace).
type Tx = (key: string, opts?: Record<string, unknown>) => string

// Calendar-day distance between two moments (ignores time-of-day): negative once
// `due` is a past calendar date, 0 on the same day, positive for a future date.
// Reads as the whole-day count a person would say out loud ("due in 4 days"),
// which a raw ms/24h division would fractionally misstate around any due TIME.
function calendarDaysDiff(due: Date, now: Date): number {
  const d = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((d.getTime() - n.getTime()) / 86400000)
}

/**
 * buildTaskAdviceInsights — Koios AI insights for the task drawer (T4): three FE
 * heuristics built from data the drawer already has (no AI/API call) — deadline
 * health, assignment, and whether the task is linked to any record. Mirrors the
 * vacancy drawer's buildVacancyAdviceInsights (§3A blueprint component).
 */
export function buildTaskAdviceInsights(task: TaskDetail, t: Tx, now: Date = new Date()): KoiosAdviceInsight[] {
  // Deadline: unset / overdue / due today / upcoming, in whole days (never a raw date
  // string here — the builder has no date-formatting hook, mirrors vacancyAiInsights).
  const dueMoment = task.due ? dueDateTime(task.due, task.dueTime) : null
  let dueInsight: KoiosAdviceInsight
  if (!dueMoment) {
    dueInsight = { type: t('ai.dueLabel'), color: 'var(--text-muted)', text: t('ai.dueUnset') }
  } else if (isTaskOverdue(task, now)) {
    const days = Math.max(1, -calendarDaysDiff(dueMoment, now))
    // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
    dueInsight = { type: t('ai.dueLabel'), color: 'var(--color-danger)', text: t('ai.dueOverdue', { count: days }) }
  } else {
    const days = calendarDaysDiff(dueMoment, now)
    dueInsight = days <= 0
      ? { type: t('ai.dueLabel'), color: 'var(--color-warning)', text: t('ai.dueToday') }
      // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
      : { type: t('ai.dueLabel'), color: 'var(--color-success)', text: t('ai.dueUpcoming', { count: days }) }
  }

  // Assignment: bureau (unassigned) vs a named assignee.
  const assigneeInsight: KoiosAdviceInsight = task.assigneeId == null
    ? { type: t('ai.assigneeLabel'), color: 'var(--color-warning)', text: t('ai.unassigned') }
    // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
    : { type: t('ai.assigneeLabel'), color: 'var(--color-success)', text: t('ai.assignedTo', { name: task.assignee?.name ?? '' }) }

  // Links: whether this task is coupled to any record at all (candidate/customer/…).
  const linkCount = (task.links ?? []).length
  const linksInsight: KoiosAdviceInsight = linkCount === 0
    ? { type: t('ai.linksLabel'), color: 'var(--color-warning)', text: t('ai.noLinks') }
    : { type: t('ai.linksLabel'), color: 'var(--color-secondary)', text: t('ai.linked', { count: linkCount }) }

  return [dueInsight, assigneeInsight, linksInsight]
}
