/**
 * AssignmentCard — the "Toewijzing" card of AddTaskModal: who is doing the
 * task (the assignee picker, defaulting to the logged-in user when they are
 * an assignable tenant user — see AddTaskModal's `meIsAssignable` guard) and
 * who created it (read-only). Split out of the former combined LinkCard
 * (Danny: "+ Nieuwe taak" brought in line with +Match's calm four-card layout
 * — Taak · Planning · Koppelingen · Toewijzing) so "what it links to" and
 * "who owns it" read as two distinct concerns, mirroring +Match's Contract/
 * Financieel split. Pure presentational: form values in, `set()` out.
 *
 * PUNT 14/15/16 follow-up (Danny 08-08, "toewijzen aan Backoffice"). Two things
 * landed here, both measured first (see `assigneeOptions.ts` for the API facts):
 *  - The colleague list is GROUPED PER ROLE and each option carries its role, so
 *    the picker's own search box finds "iemand van Backoffice" in one word. There
 *    is deliberately NO department/team picker: a task has one `assignee_id`
 *    validated as a tenant USER, `GET /teams` is a 404, and a control with
 *    nowhere to save is the fake affordance §3 forbids.
 *  - "Bureau" (nobody assigned) is an explicit first option with a plain-language
 *    hint under the field, instead of an unexplained empty value.
 * The list's four UI states are honest (§3): loading · load error + retry ·
 * only-the-bureau (empty) · a real colleague list. The picker itself always
 * renders, because the bureau choice stays valid even when /users fails.
 */
import type { TFunction } from 'i18next'
import { Field } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, pickerStyle, PICKER_MENU_W } from './fields'
import { UNASSIGNED_VALUE } from './assigneeOptions'
import type { AssigneeOption } from './assigneeOptions'
import type { TaskForm } from '../AddTaskModal'

// One muted helper/status line under the picker — one look for all four states.
const noticeStyle = { marginTop: 6, fontSize: 11, lineHeight: 1.4, color: 'var(--text-muted)' } as const

export default function AssignmentCard({ t, form, set, assigneeOpts, ownerName, usersLoading, usersError, hasColleagues, onRetryUsers }: {
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
}) {
  const unassigned = form.assigneeId === UNASSIGNED_VALUE

  return (
    <div>
      <div style={cardHead}>{t('modal.cardAssignment')}</div>
      <div style={cardBox}>
        {/* Uitvoerder — a searchable picker over the role-grouped colleague list;
            the empty value is a real first entry ("Bureau"), never a placeholder,
            because `assignee_id: null` is a measured, accepted create. */}
        <div>
          <Field label={t('modal.assignee')}>
            <CreatableSelect value={form.assigneeId} onChange={(v: string) => set('assigneeId', v)} allowCreate={false}
              style={pickerStyle} menuWidth={PICKER_MENU_W} options={assigneeOpts} />
          </Field>

          {/* Exactly one status/help line, in state order: error wins over
              loading, loading over empty, and the bureau hint shows only once the
              list is settled and nobody is assigned. */}
          {usersError ? (
            <div role="alert" style={{ ...noticeStyle, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger)' }}>
              <span>{t('modal.assigneeLoadError')}</span>
              {onRetryUsers && (
                <button type="button" onClick={onRetryUsers}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                    padding: '2px 8px', cursor: 'pointer', color: 'var(--text)', fontSize: 11 }}>
                  {t('common:error.retry')}
                </button>
              )}
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
