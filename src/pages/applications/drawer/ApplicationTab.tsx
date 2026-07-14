import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { buildApplicationAdviceInsights } from './applicationAiInsights'
import MatchScoreBlock from './MatchScoreBlock'
import type { Criterion } from './MatchScoreBlock'
import RejectionBlock from './RejectionBlock'
import type { RejectPayload } from './RejectionBlock'
import VacancyLinkField from './VacancyLinkField'
import { useVacancyLinkOptions } from '../hooks/useVacancyLinkOptions'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'

// A small label-above-value field.
function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{children}</div>
    </div>
  )
}

const iconBtn = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' } as const

interface ApplicationTabProps {
  application: ApplicationDetail
  onReject?: (id: Id | undefined, payload: RejectPayload) => void
  onAdjustScore?: (id: Id | undefined, payload: { score: number | null; criteria: Criterion[] }) => void
  // Re-link (or unlink, null) the vacancy this application is coupled to (BE:
  // PATCH /applications/{id} vacancy_id, nullable). Klant is derived from the
  // picked option so the caller can update it optimistically before the PATCH
  // response reconciles it. Undefined hides the pencil (read-only caller).
  onLinkVacancy?: (id: Id | undefined, vacancyId: Id | null, meta?: { title?: string; client?: string }) => void
}

/**
 * ApplicationTab — the "Sollicitatie" tab: the AI task, the Details block (the
 * vacancy link is editable in-place; Bron + Klant stay read-only — Klant is
 * derived from the vacancy) and the overall match score. Phase + recruiter are
 * edited from the drawer header (meta pickers), so they no longer live here.
 */
export default function ApplicationTab({ application: a, onReject, onAdjustScore, onLinkVacancy }: ApplicationTabProps) {
  const { t } = useTranslation(['applications', 'common'])
  // In-place edit of the vacancy link — pencil → searchable picker → diskette/✕
  // (§3A house pattern, mirrors KlantTab). Options only load while editing.
  const [editing, setEditing] = useState(false)
  const [vacancyId, setVacancyId] = useState('')
  const vacancyOptions = useVacancyLinkOptions(editing)

  const startEdit = () => { setVacancyId(a.vacancyId != null ? String(a.vacancyId) : ''); setEditing(true) }
  const cancelEdit = () => setEditing(false)
  const saveEdit = () => {
    const picked = vacancyId ? vacancyOptions.find(v => String(v.value) === vacancyId) : undefined
    onLinkVacancy?.(a.id, vacancyId || null, { title: picked?.label, client: picked?.client })
    setEditing(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* AI task */}
      {a.task && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{t('drawer.task')}</div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--color-primary-bg)',
            borderRadius: 8, alignItems: 'flex-start' }}>
            <KoiosAiMark size={20} />
            <span style={{ fontSize: 13, color: 'var(--color-primary)', lineHeight: 1.5 }}>{a.task}</span>
          </div>
        </div>
      )}

      {/* Details — Bron/Klant stay read-only (Klant derives from the vacancy);
          the vacancy link itself is editable in-place (phase/recruiter are
          edited in the header instead). */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('drawer.details')}</div>
          {/* In-place edit toggle: pencil → diskette + ✕, same spot (§0.3 pattern). */}
          {onLinkVacancy && (editing ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={saveEdit} title={t('common:save')} aria-label={t('common:save')}
                style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
              <button onClick={cancelEdit} title={t('common:cancel')} aria-label={t('common:cancel')}
                style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
            </div>
          ) : (
            <button onClick={startEdit} title={t('common:edit')} aria-label={t('common:edit')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}><Edit2 size={13} /></button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
          <Field label={t('drawer.source')}>{a.source || '—'}</Field>
          <Field label={t('drawer.client')}>{a.client || '—'}</Field>
          <div style={{ gridColumn: '1 / -1' }}>
            {editing ? (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{t('drawer.vacancy')}</div>
                <VacancyLinkField value={vacancyId} options={vacancyOptions} onChange={setVacancyId} />
              </div>
            ) : (
              <Field label={t('drawer.vacancy')}>{a.vacancyTitle || '—'}</Field>
            )}
          </div>
        </div>
      </div>

      {/* Koios AI advisory — phase progress + vacancy-link completeness (§3A blueprint). */}
      <KoiosAdviceBlock namespace="applications" insights={buildApplicationAdviceInsights(a, t)} />

      {/* Match score — overall + configured criteria breakdown. */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{t('matchScore.title')}</div>
        <MatchScoreBlock score={a.score} criteria={a.matchCriteria as Criterion[]} summary={a.matchSummary}
          source={a.matchSource} aiScore={a.aiScore}
          onSave={onAdjustScore ? payload => onAdjustScore(a.id, payload) : undefined} />
      </div>

      {/* Rejection — hidden once the application is a placement (matched). */}
      {a.bucket !== 'matched' && <RejectionBlock application={a} onReject={onReject} />}
    </div>
  )
}
