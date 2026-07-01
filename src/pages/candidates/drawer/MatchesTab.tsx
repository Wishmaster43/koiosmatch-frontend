import { useTranslation } from 'react-i18next'
import { Link2, ExternalLink } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import StatusPill from '@/components/ui/StatusPill'
import type { ReactNode } from 'react'
import type { Candidate } from '@/types/candidate'

// Match score as a soft-coloured percentage (green ≥75, amber ≥50, red below).
function ScorePill({ value }: { value?: number | null }) {
  if (value == null) return null
  const c = value >= 75 ? 'var(--color-success)' : value >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
  return <span style={{ fontSize: 11, fontWeight: 700, color: c }}>{value}%</span>
}

/**
 * MatchesTab — READ-ONLY view of the candidate's matches (decided model: a Match
 * is its own entity; the contract lives in HelloFlex, we only show its status).
 * No CRUD here — matches are created from the application funnel / direct-match
 * flow, not edited as a contract sub-entity on the candidate.
 */
export default function MatchesTab({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const matches = c.matches ?? []

  return (
    <SectionCard title={t('matchesView.title')}>
      {matches.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('matchesView.empty')}</div>
      ) : matches.map((m, i) => (
        <div key={m.id ?? i} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
          {/* Header: vacancy + score + (subtle) backoffice-link icon when coupled */}
          <div style={{ padding: '8px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{m.vacancyTitle || m.client || '—'}</span>
            {m.helloflex_contract_guid ? (
              <span title={t('matchesView.backofficeLinked')} style={{ display: 'flex', color: 'var(--color-primary)' }}><Link2 size={13} /></span>
            ) : null}
            {/* Read-only link out to the vacancy when the API exposes a URL. */}
            {m.vacancyUrl ? (
              <a href={m.vacancyUrl} target="_blank" rel="noopener noreferrer" title={t('work.openVacancy')}
                style={{ display: 'flex', color: 'var(--text-muted)' }}><ExternalLink size={12} /></a>
            ) : null}
            <ScorePill value={m.score} />
          </div>
          {([
            [t('matchesView.client'),  m.client || '—'],
            [t('matchesView.stage'),   m.stage ? <StatusPill label={m.stage} color={m.stageColor} /> : '—'],
            [t('matchesView.contract'), t(`matchesView.contractStatus.${m.contractStatus ?? 'none'}`, { defaultValue: m.contractStatus || t('matchesView.contractStatus.none') })],
          ] as Array<[string, ReactNode]>).map(([label, value]) => (
            <div key={label} style={{ display: 'flex', padding: '7px 12px', borderBottom: '1px solid var(--border)', gap: 16, background: 'var(--surface)', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{value}</span>
            </div>
          ))}
        </div>
      ))}
    </SectionCard>
  )
}
