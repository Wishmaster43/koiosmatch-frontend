import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { buildApplicationAdviceInsights } from './applicationAiInsights'
import MatchScoreBlock from './MatchScoreBlock'
import type { Criterion } from './MatchScoreBlock'
import RejectionBlock from './RejectionBlock'
import type { RejectPayload } from './RejectionBlock'
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

interface ApplicationTabProps {
  application: ApplicationDetail
  onReject?: (id: Id | undefined, payload: RejectPayload) => void
  onAdjustScore?: (id: Id | undefined, payload: { score: number | null; criteria: Criterion[] }) => void
}

/**
 * ApplicationTab — the "Sollicitatie" tab: the AI task, the key (read-only)
 * details and the overall match score. Phase + recruiter are edited from the
 * drawer header (meta pickers), so they no longer live in the tab body.
 */
export default function ApplicationTab({ application: a, onReject, onAdjustScore }: ApplicationTabProps) {
  const { t } = useTranslation('applications')

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

      {/* Details — read-only provenance (phase/recruiter are edited in the header). */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{t('drawer.details')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
          <Field label={t('drawer.source')}>{a.source || '—'}</Field>
          <Field label={t('drawer.client')}>{a.client || '—'}</Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label={t('drawer.vacancy')}>{a.vacancyTitle || '—'}</Field>
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
