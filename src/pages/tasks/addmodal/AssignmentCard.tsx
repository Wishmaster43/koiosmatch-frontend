/**
 * AssignmentCard — the "Toewijzing" card of AddTaskModal: WHERE the task waits
 * (the internal-department picker), WHO is doing it (the assignee picker,
 * defaulting to the logged-in user when they are an assignable tenant user — see
 * AddTaskModal's `meIsAssignable` guard) and who created it (read-only). Split
 * out of the former combined LinkCard (Danny: "+ Nieuwe taak" brought in line
 * with +Match's calm four-card layout — Taak · Planning · Koppelingen ·
 * Toewijzing) so "what it links to" and "who owns it" read as two distinct
 * concerns, mirroring +Match's Contract/Financieel split. Pure presentational:
 * form values in, `set()` out.
 *
 * TEAM-1 (Danny 09-08, "een nieuwe taak moet ook op een afdeling zoals Backoffice
 * kunnen"). The department picker sits NEXT TO the person picker, never instead
 * of it — the two axes answer different questions and the backend keeps both:
 *  - `assignee_team_id` = where the task waits (Backoffice).
 *  - `assignee_id`      = who picked it up.
 * Measured 09-08: a PATCH carrying ONLY `assignee_id` comes back with the same
 * `assignee_team` — assigning a person does NOT clear the department, so the
 * origin of the task survives. "Openstaand bij Backoffice" is therefore
 * department-set + person-empty, and both controls stay independently clearable.
 *
 * NAMING — the Dutch trap: this is the INTERNAL department (`tasks:modal.team`,
 * "Interne afdeling"). The `department` chip on the Koppelingen card is the
 * CUSTOMER's department ("Klantafdeling", `tasks:links.department`). Two
 * different entities, two different words, on purpose.
 *
 * Both lists render their four UI states honestly (§3): loading · load error +
 * retry · empty (nothing configured yet) · a real list. Each picker itself always
 * renders: "bureau" and "no department" stay valid choices even when a list fails.
 */
import type { TFunction } from 'i18next'
import { Field } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, pickerStyle, PICKER_MENU_W } from './fields'
import { UNASSIGNED_VALUE } from './assigneeOptions'
import type { AssigneeOption } from './assigneeOptions'
import type { TeamOption } from '@/lib/useTeams'
import type { TaskForm } from '../AddTaskModal'

// One muted helper/status line under a picker — one look for all four states.
const noticeStyle = { marginTop: 6, fontSize: 11, lineHeight: 1.4, color: 'var(--text-muted)' } as const
// The load-error line reuses that footprint and only swaps in the danger token.
const errorNoticeStyle = { ...noticeStyle, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger)' } as const
// Ghost retry button, identical for both lists (§4: extract the repeated style).
const retryStyle = { background: 'none', border: '1px solid var(--border)', borderRadius: 6,
  padding: '2px 8px', cursor: 'pointer', color: 'var(--text)', fontSize: 11 } as const

export default function AssignmentCard({
  t, form, set, assigneeOpts, ownerName, usersLoading, usersError, hasColleagues, onRetryUsers,
  teams, teamsLoading, teamsError, onRetryTeams,
}: {
  t: TFunction
  form: TaskForm
  set: (k: keyof TaskForm, v: string) => void
  assigneeOpts: AssigneeOption[]
  // The logged-in creator's display name — read-only, no picker (mirrors "Aangemaakt door").
  ownerName: string
  // Four UI states for the colleague list (§3) — see the header comment.
  usersLoading: boolean
  usersError: boolean
  hasColleagues: boolean
  // Absent while the query hook exposes no refetch — then no retry button renders.
  onRetryUsers?: () => void
  // TEAM-1: the tenant's internal departments + their own four UI states.
  teams: TeamOption[]
  teamsLoading: boolean
  teamsError: boolean
  onRetryTeams?: () => void
}) {
  const unassigned = form.assigneeId === UNASSIGNED_VALUE
  // Options for the department picker; "no department" is the clear (X) affordance,
  // not a fake row — `assignee_team_id: null` is a measured, accepted value.
  const teamOpts = teams.map(team => ({ value: String(team.value), label: team.label }))

  return (
    <div>
      <div style={cardHead}>{t('modal.cardAssignment')}</div>
      <div style={cardBox}>
        {/* Interne afdeling — WHERE the task waits. Searchable (never a native
            <select>) and clearable, because "no department" really persists. */}
        <div>
          <Field label={t('modal.team')}>
            <CreatableSelect value={form.teamId} onChange={(v: string) => set('teamId', v)} allowCreate={false}
              style={pickerStyle} menuWidth={PICKER_MENU_W} options={teamOpts}
              clearable clearLabel={t('modal.team')} placeholder={t('modal.teamPlaceholder')} />
          </Field>

          {/* Exactly one status/help line, in state order: error > loading > empty >
              the plain-language explanation of what a department does here. */}
          {teamsError ? (
            <div role="alert" style={errorNoticeStyle}>
              <span>{t('modal.teamLoadError')}</span>
              {onRetryTeams && <button type="button" onClick={onRetryTeams} style={retryStyle}>{t('common:error.retry')}</button>}
            </div>
          ) : teamsLoading ? (
            <div style={noticeStyle}>{t('common:loading')}</div>
          ) : teams.length === 0 ? (
            <div style={noticeStyle}>{t('modal.teamEmpty')}</div>
          ) : (
            <div style={noticeStyle}>{t('modal.teamHint')}</div>
          )}
        </div>

        {/* Uitvoerder — a searchable picker over the role-grouped colleague list;
            the empty value is a real first entry ("Bureau"), never a placeholder,
            because `assignee_id: null` is a measured, accepted create. Picking a
            person here leaves the department above untouched (TEAM-1). */}
        <div>
          <Field label={t('modal.assignee')}>
            <CreatableSelect value={form.assigneeId} onChange={(v: string) => set('assigneeId', v)} allowCreate={false}
              style={pickerStyle} menuWidth={PICKER_MENU_W} options={assigneeOpts} />
          </Field>

          {/* Exactly one status/help line, in state order: error wins over
              loading, loading over empty, and the bureau hint shows only once the
              list is settled and nobody is assigned. */}
          {usersError ? (
            <div role="alert" style={errorNoticeStyle}>
              <span>{t('modal.assigneeLoadError')}</span>
              {onRetryUsers && <button type="button" onClick={onRetryUsers} style={retryStyle}>{t('common:error.retry')}</button>}
            </div>
          ) : usersLoading ? (
            <div style={noticeStyle}>{t('common:loading')}</div>
          ) : !hasColleagues ? (
            <div style={noticeStyle}>{t('modal.assigneeEmpty')}</div>
          ) : unassigned ? (
            <div style={noticeStyle}>{t('modal.assigneeUnassignedHint')}</div>
          ) : null}
        </div>

        {/* Read-only creator — no picker, mirrors the old Details panel line. */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{t('modal.owner')}</div>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>{ownerName || '—'}</div>
        </div>
      </div>
    </div>
  )
}
