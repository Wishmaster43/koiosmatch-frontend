import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import StatusPill from '@/components/ui/StatusPill'
import EntityLink, { buildEntityDeepLink } from '@/components/ui/EntityLink'
import BackofficeCouplingIndicator from '@/components/ui/BackofficeCouplingIndicator'
import ScorePill from '@/pages/matches/ScorePill'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useApps } from '@/context/AppsContext'
import { useCustomerMatches } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'
import type { ReactNode } from 'react'

/**
 * MatchesTab — the customer's matches, mirroring the candidate drawer's own
 * MatchesTab 1:1 (§3A/§3B): read-only cards (a match is opened/edited in its own
 * drawer, never here — no pencil, no MatchModal), same row labels, same empty
 * state. The one swap: the candidate card's "Client" row becomes "Candidate"
 * here, since the customer is already the fixed side of every row.
 *
 * Lazily fetched (§9): only mounts — and only then fires GET /matches?customer_id=
 * — when this tab is the active one, same as every other customer drawer tab.
 */
export default function MatchesTab({ customerId }: { customerId?: Id }) {
  const { t } = useTranslation(['customers', 'candidates', 'matches'])
  // Match lifecycle lookup (R-1b) — resolves the "Fase" row's label/colour from the
  // status slug, same source the candidate card and the matches page table use.
  const { metaOf: matchStatusMeta } = useMatchStatuses()
  // Backoffice coupling glyph — gated on the tenant's own enabled apps, mirrors MatchesTable.
  const apps = useApps()
  const showHelloflex = apps?.isAppEnabled('hf') ?? false
  const showShiftmanager = apps?.isAppEnabled('shiftmanager') ?? false
  const { rows: matches, loading, error } = useCustomerMatches(customerId)

  // Four explicit UI states (§3): loading / error / empty / success.
  if (loading) return <SectionCard><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('customers:page.loading')}</div></SectionCard>
  if (error) return <SectionCard><div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('customers:matches.loadError')}</div></SectionCard>

  return (
    <SectionCard>
      {matches.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('candidates:matchesView.empty')}</div>
      ) : matches.map((m, i) => {
        const statusMeta = matchStatusMeta(m.status ?? undefined)
        const stageLabel = statusMeta?.label ?? m.stage
        const stageColor = statusMeta?.color ?? m.stageColor
        return (
        <div key={m.id ?? i} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
          {/* Header: vacancy + score + (gated) backoffice coupling glyph. */}
          <div style={{ padding: '8px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
              <EntityLink page="vacancies" id={m.vacancyId} title={m.vacancy || '—'}>{m.vacancy || '—'}</EntityLink>
            </span>
            {m.id != null && (
              // Explicit "Open match" new-tab affordance (mirrors the candidate card).
              <a href={buildEntityDeepLink('matches', m.id)} target="_blank" rel="noopener noreferrer"
                title={t('candidates:matchesView.openMatch')} aria-label={t('candidates:matchesView.openMatch')}
                style={{ display: 'flex', color: 'var(--color-primary)', padding: 2 }}>
                <ExternalLink size={12} />
              </a>
            )}
            {/* Only shown once the tenant actually enabled a backoffice system — a bare
                "not linked" dash for every match on a tenant without either module
                would just be clutter (unlike the dedicated table column it mirrors). */}
            {(showHelloflex || showShiftmanager) && (
              <BackofficeCouplingIndicator helloflexLink={m.helloflexLink} shiftmanagerLink={m.shiftmanagerLink}
                showHelloflex={showHelloflex} showShiftmanager={showShiftmanager} />
            )}
            <ScorePill value={m.score} />
          </div>
          {([
            [t('matches:cols.candidate'),          <EntityLink key="cand" page="candidates" id={m.candidateId}>{m.candidate || '—'}</EntityLink>],
            [t('candidates:matchesView.contractType'), m.contractType || '—'],
            [t('candidates:matchesView.stage'),        stageLabel ? <StatusPill label={stageLabel} color={stageColor} /> : '—'],
            [t('candidates:matchesView.contract'),     t(`candidates:matchesView.contractStatus.${m.contractStatus ?? 'none'}`, { defaultValue: m.contractStatus || t('candidates:matchesView.contractStatus.none') })],
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
