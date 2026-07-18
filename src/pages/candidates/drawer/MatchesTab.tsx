import { useTranslation } from 'react-i18next'
import { Link2, ExternalLink } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import StatusPill from '@/components/ui/StatusPill'
import EntityLink from '@/components/ui/EntityLink'
import { useNavigation } from '@/context/NavigationContext'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { rememberReturnTab } from './constants'
import type { ReactNode } from 'react'
import type { Candidate } from '@/types/candidate'
import { isSafeUrl } from '@/lib/safeUrl'

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
  const { openEntity } = useNavigation()
  // Match lifecycle lookup (R-1b) — resolves the "Fase" row's label/colour from the
  // status slug, same as MatchesTable/MatchDrawer; the backend-resolved stage/
  // stageColor stay the fallback for payloads that don't send the slug yet.
  const { metaOf: matchStatusMeta } = useMatchStatuses()
  const matches = c.matches ?? []

  return (
    // No title here (Danny addendum 4): this only ever renders inside the Match
    // tab's own "Matches" sub-tab — a second "Matches" heading would just repeat
    // the sub-tab bar right above it.
    <SectionCard>
      {matches.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('matchesView.empty')}</div>
      ) : matches.map((m, i) => {
        const statusMeta = matchStatusMeta(m.status ?? undefined)
        const stageLabel = statusMeta?.label ?? m.stage
        const stageColor = statusMeta?.color ?? m.stageColor
        return (
        <div key={m.id ?? i} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
          {/* Header: vacancy + score + (subtle) backoffice-link icon when coupled */}
          <div style={{ padding: '8px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
              {/* Danny 16-07 (punt 15): ANY cross-entity jump from this card must return
                  to the Werk tab — the stash was only on the match button before. */}
              <span onClickCapture={() => rememberReturnTab(c.id, 'work')}>
                <EntityLink page="vacancies" id={m.vacancyId} title={m.vacancyTitle || m.client || '—'}>{m.vacancyTitle || m.client || '—'}</EntityLink>
              </span>
            </span>
            {m.id != null && (
              // NAV-BACK-1: remember this subtab (Work/Match) so BACK from the
              // opened match lands on the same drawer tab instead of Profile.
              <button onClick={() => { rememberReturnTab(c.id, 'work'); openEntity('matches', m.id) }}
                title={t('matchesView.openMatch')} aria-label={t('matchesView.openMatch')}
                style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 2 }}>
                <ExternalLink size={12} />
              </button>
            )}
            {m.helloflex_contract_guid ? (
              <span title={t('matchesView.backofficeLinked')} style={{ display: 'flex', color: 'var(--color-primary)' }}><Link2 size={13} /></span>
            ) : null}
            {/* Read-only link out to the vacancy when the API exposes a URL. */}
            {isSafeUrl(m.vacancyUrl) ? (
              <a href={m.vacancyUrl} target="_blank" rel="noopener noreferrer" title={t('work.openVacancy')}
                style={{ display: 'flex', color: 'var(--text-muted)' }}><ExternalLink size={12} /></a>
            ) : null}
            <ScorePill value={m.score} />
          </div>
          {([
            [t('matchesView.client'),       m.client || '—'],
            [t('matchesView.contractType'), m.contractType || '—'],
            [t('matchesView.stage'),        stageLabel ? <StatusPill label={stageLabel} color={stageColor} /> : '—'],
            [t('matchesView.contract'),     t(`matchesView.contractStatus.${m.contractStatus ?? 'none'}`, { defaultValue: m.contractStatus || t('matchesView.contractStatus.none') })],
          ] as Array<[string, ReactNode]>).map(([label, value]) => (
            <div key={label} style={{ display: 'flex', padding: '7px 12px', borderBottom: '1px solid var(--border)', gap: 16, background: 'var(--surface)', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{value}</span>
            </div>
          ))}
        </div>
        )
      })}
    </SectionCard>
  )
}
