/**
 * TargetsTab — the call list itself: one row per target (candidate) with a status
 * soft-chip, quick check-off actions and — once handled — the call OUTCOME (Danny
 * 2026-07-04): outcome chips from the /outreach-outcomes lookup + follow-ups
 * (new task pre-linked to the candidate · create a match on a vacancy). The name
 * clicks through to the candidate drawer. Presentational; data + mutations come
 * from useOutreachDetail via the drawer.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Phone, X, RotateCcw, ListChecks, Handshake } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import AddTaskModal from '@/pages/tasks/AddTaskModal'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { initialsOf } from '@/lib/initials'
import { useDateFormat } from '@/lib/datetime'
import { useNavigation } from '@/context/NavigationContext'
import { useOutreachOutcomes } from '@/lib/useOutreachOutcomes'
import { useOutreachStatuses } from '@/lib/useOutreachStatuses'
import { useVacancyOptions } from '@/pages/candidates/hooks/useVacancyOptions'
import type { OutreachTarget } from '../hooks/useOutreachDetail'

export default function TargetsTab({ targets, loading, error, onSetStatus, onSetOutcome }: {
  targets: OutreachTarget[]
  loading: boolean
  error: boolean
  onSetStatus: (id: string, status: string) => void
  onSetOutcome: (id: string, outcome: string | null) => void
}) {
  const { t } = useTranslation('outreach')
  const { formatDate } = useDateFormat()
  const { openEntity } = useNavigation()
  const { outcomes } = useOutreachOutcomes()
  // Entry statuses from the tenant lookup (R-1b) — the is_reached FLAG drives
  // behaviour, so tenant-added statuses appear here without any code change.
  const { statuses, metaOf, initial } = useOutreachStatuses()
  // Per-row follow-up state: which target has the task modal / match prompt open.
  const [taskFor,  setTaskFor]  = useState<OutreachTarget | null>(null)
  const [matchFor, setMatchFor] = useState<OutreachTarget | null>(null)
  const [matchVacancyId, setMatchVacancyId] = useState('')
  const [matchSaving, setMatchSaving] = useState(false)
  // Vacancy options only load while the match prompt is open.
  const vacancyOptions = useVacancyOptions(!!matchFor)

  const candidateName = (tg: OutreachTarget) =>
    tg.candidate?.name ?? [tg.candidate?.first_name, tg.candidate?.last_name].filter(Boolean).join(' ') ?? '—'

  // Create the match via the canonical direct-match endpoint (G-2, mirrors useCreateMatch).
  const confirmMatch = async () => {
    if (!matchFor?.candidate?.id || !matchVacancyId) return
    setMatchSaving(true)
    try {
      await api.post('/matches', { candidate_id: matchFor.candidate.id, vacancy_id: matchVacancyId })
      notifySuccess(t('drawer.matchCreated'))
      setMatchFor(null); setMatchVacancyId('')
    } catch {
      notifyError(t('drawer.matchFailed'))
    } finally { setMatchSaving(false) }
  }

  // Four UI states — never a blank panel.
  if (loading) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.loading')}</p>
  if (error)   return <p style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('drawer.error')}</p>
  if (!targets.length) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.empty')}</p>

  const actBtn = (title: string, onClick: () => void, icon: React.ReactNode, color: string, key?: string) => (
    <button key={key} onClick={onClick} title={title} aria-label={title}
      style={{ width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, cursor: 'pointer', color, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, transparent)` }}>
      {icon}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {targets.map(tg => {
        const st   = tg.status ?? initial?.value ?? 'todo'
        const meta = metaOf(st)
        const col  = meta?.color ?? 'var(--text-muted)'
        const handled = st !== (initial?.value ?? 'todo')
        return (
          <div key={tg.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px',
            border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar initials={initialsOf(candidateName(tg))} size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name → jump to the candidate drawer (cross-entity intent). */}
                <button onClick={() => tg.candidate?.id && openEntity('candidates', tg.candidate.id)}
                  title={t('drawer.action.openCandidate')}
                  style={{ display: 'block', maxWidth: '100%', padding: 0, background: 'none', border: 'none', cursor: tg.candidate?.id ? 'pointer' : 'default',
                    fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                  {candidateName(tg)}
                </button>
                {tg.contacted_at && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(tg.contacted_at)}</div>
                )}
              </div>
              {/* Status soft-chip */}
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, color: col,
                background: `color-mix(in srgb, ${col} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${col} 35%, transparent)` }}>
                {meta?.label ?? t(`drawer.target.${st}`, { defaultValue: st })}
              </span>
              {/* Quick check-off: contacted / answered / skipped; done rows can reset to todo. */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {!handled ? (
                  <>
                    {statuses.filter(o => o.value !== (initial?.value ?? 'todo')).map(o =>
                      actBtn(o.label, () => onSetStatus(tg.id, o.value),
                        o.is_reached ? <Phone size={12} /> : <X size={12} />, o.color ?? 'var(--color-primary)', o.value))}
                  </>
                ) : (
                  <>
                    {actBtn(t('drawer.action.newTask'),   () => setTaskFor(tg), <ListChecks size={12} />, 'var(--color-primary)')}
                    {actBtn(t('drawer.action.makeMatch'), () => { setMatchFor(tg); setMatchVacancyId('') }, <Handshake size={12} />, 'var(--color-success)')}
                    {actBtn(t('drawer.action.reset'),     () => onSetStatus(tg.id, initial?.value ?? 'todo'), <RotateCcw size={12} />, 'var(--text-muted)')}
                  </>
                )}
              </div>
            </div>

            {/* Outcome chips — record HOW the call ended (lookup-driven; click again to clear). */}
            {handled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingLeft: 36 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('drawer.outcomeLabel')}</span>
                {outcomes.map(o => {
                  const active = tg.outcome === o.value
                  const oc = o.color ?? 'var(--color-primary)'
                  return (
                    <button key={o.value} onClick={() => onSetOutcome(tg.id, active ? null : o.value)}
                      style={{ padding: '2px 9px', fontSize: 10, fontWeight: active ? 600 : 500, borderRadius: 99, cursor: 'pointer',
                        color: oc, background: `color-mix(in srgb, ${oc} ${active ? 16 : 8}%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${oc} ${active ? 50 : 28}%, transparent)` }}>
                      {o.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Inline match prompt for THIS row: pick a vacancy → POST /matches. */}
            {matchFor?.id === tg.id && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 36 }}>
                <select value={matchVacancyId} onChange={e => setMatchVacancyId(e.target.value)}
                  style={{ flex: 1, minWidth: 0, padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', outline: 'none' }}>
                  <option value="">{t('drawer.matchPick')}</option>
                  {vacancyOptions.map(v => <option key={String(v.value)} value={String(v.value)}>{v.label}{v.client ? ` — ${v.client}` : ''}</option>)}
                </select>
                <button onClick={confirmMatch} disabled={!matchVacancyId || matchSaving}
                  style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 7, border: 'none', cursor: (!matchVacancyId || matchSaving) ? 'not-allowed' : 'pointer',
                    background: 'var(--color-primary)', color: '#fff', opacity: (!matchVacancyId || matchSaving) ? 0.5 : 1 }}>
                  {t('drawer.matchConfirm')}
                </button>
                <button onClick={() => setMatchFor(null)} title={t('common:cancel')} aria-label={t('common:cancel')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* New task pre-linked to the row's candidate (shared modal). */}
      {taskFor?.candidate?.id && (
        <AddTaskModal
          initial={{ candidateId: String(taskFor.candidate.id) }}
          onClose={() => setTaskFor(null)}
          onCreated={() => setTaskFor(null)}
        />
      )}
    </div>
  )
}
