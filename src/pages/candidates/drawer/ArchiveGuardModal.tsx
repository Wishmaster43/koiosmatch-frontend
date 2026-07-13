/**
 * ArchiveGuardModal — the interception popup for archive/prullenbak (§3B): a
 * candidate must never move to Gearchiveerd or Prullenbak while a live
 * application or active match still hangs on it. Lists every blocker with its
 * required resolution (reject the application(s) / end the match(es)); one
 * button resolves everything in sequence, then the caller proceeds with the
 * actual archive/mark-deletion call. Works in both single (`candidateName`)
 * and bulk (`aggregate`) mode — same flow, different title/verb (mode prop).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, AlertTriangle } from 'lucide-react'
import SoftChip from '@/components/ui/SoftChip'
import { resolveApplication, resolveMatch } from '../data/archiveGuard'
import type { BlockingApplication, BlockingMatch } from '../data/archiveGuard'

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 70 }
const panel: React.CSSProperties = {
  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 71,
  width: 460, maxWidth: '92vw', maxHeight: '82vh', overflowY: 'auto',
  background: 'var(--surface)', borderRadius: 12, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
}
const sectionHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8,
}
const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)',
}
const rowStyle = (last: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', fontSize: 12.5, color: 'var(--text)',
  borderBottom: last ? 'none' : '1px solid var(--border)',
})

interface Props {
  // 'archive' → Gearchiveerd; 'trash' → Prullenbak (drives title + resolve-button verb).
  mode: 'archive' | 'trash'
  candidateName?: string
  // Bulk mode: how many of the selection are blocked vs. the total selected.
  aggregate?: { blockedCount: number; totalCount: number }
  applications: BlockingApplication[]
  matches: BlockingMatch[]
  onClose: () => void
  // Called once every blocker resolved cleanly — the caller then proceeds.
  onResolved: () => void
}

export default function ArchiveGuardModal({ mode, candidateName, aggregate, applications: initialApps, matches: initialMatches, onClose, onResolved }: Props) {
  const { t } = useTranslation(['candidates', 'common'])
  const [applications, setApplications] = useState(initialApps)
  const [matches, setMatches] = useState(initialMatches)
  const [matchErrors, setMatchErrors] = useState<Record<string, boolean>>({})
  const [resolving, setResolving] = useState(false)

  const hasBlockers = applications.length > 0 || matches.length > 0
  const anyConflict = Object.values(matchErrors).some(Boolean)

  // Resolve every listed blocker: applications → reject, matches → soft-delete.
  // Whatever fails (e.g. a HelloFlex-conflict match) stays listed + errored; the
  // parent action only proceeds once nothing remains.
  const resolveAll = async () => {
    setResolving(true)
    const appResults = await Promise.all(applications.map(a => resolveApplication(a.id)))
    const stillApps = applications.filter((_, i) => !appResults[i])

    const matchResults = await Promise.all(matches.map(m => resolveMatch(m.id)))
    const stillMatches = matches.filter((_, i) => !matchResults[i].ok)
    const errs: Record<string, boolean> = {}
    matches.forEach((m, i) => { if (!matchResults[i].ok) errs[String(m.id)] = matchResults[i].conflict })

    setApplications(stillApps)
    setMatches(stillMatches)
    setMatchErrors(errs)
    setResolving(false)
    if (!stillApps.length && !stillMatches.length) onResolved()
  }

  return (
    <>
      <div style={overlay} onClick={onClose} />
      <div style={panel} role="dialog" aria-modal="true" aria-label={t('archiveGuard.title')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}><AlertTriangle size={16} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{t('archiveGuard.title')}</span>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 14, lineHeight: 1.5 }}>
          {aggregate
            ? t('archiveGuard.bodyAggregate', { blocked: aggregate.blockedCount, total: aggregate.totalCount })
            : t('archiveGuard.body', { name: candidateName })}
        </p>

        {applications.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={sectionHeader}>
              <span style={sectionLabel}>{t('archiveGuard.applicationsTitle')}</span>
              <span style={{ fontSize: 11.5, color: 'var(--color-danger)', fontWeight: 600 }}>{t('archiveGuard.resolutionReject')}</span>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {applications.map((a, i) => (
                <div key={a.id} style={rowStyle(i === applications.length - 1)}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.candidateName && <strong style={{ fontWeight: 600 }}>{a.candidateName} · </strong>}
                    {a.vacancyTitle}
                  </span>
                  <SoftChip label={a.stageLabel} color={a.stageColor} />
                </div>
              ))}
            </div>
          </div>
        )}

        {matches.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={sectionHeader}>
              <span style={sectionLabel}>{t('archiveGuard.matchesTitle')}</span>
              <span style={{ fontSize: 11.5, color: 'var(--color-danger)', fontWeight: 600 }}>{t('archiveGuard.resolutionEndMatch')}</span>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {matches.map((m, i) => (
                <div key={String(m.id)} style={{ borderBottom: i === matches.length - 1 ? 'none' : '1px solid var(--border)' }}>
                  <div style={rowStyle(true)}>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.candidateName && <strong style={{ fontWeight: 600 }}>{m.candidateName} · </strong>}
                      {[m.vacancyTitle, m.client].filter(Boolean).join(' · ')}
                    </span>
                    <SoftChip label={t(`archiveGuard.matchStatus.${m.statusKey}`, { defaultValue: m.statusKey })} color="var(--color-warning)" />
                  </div>
                  {matchErrors[String(m.id)] && (
                    <div style={{ padding: '0 12px 8px', fontSize: 11.5, color: 'var(--color-danger)' }}>{t('archiveGuard.matchConflict')}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {anyConflict && (
          <p style={{ fontSize: 11.5, color: 'var(--color-danger)', marginBottom: 10 }}>{t('archiveGuard.stillBlocked')}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
            {t('common:cancel')}
          </button>
          <button onClick={resolveAll} disabled={resolving || !hasBlockers}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: 'var(--color-danger)', color: '#fff', cursor: 'pointer', opacity: (resolving || !hasBlockers) ? 0.6 : 1 }}>
            {resolving ? t('archiveGuard.resolving') : t(mode === 'trash' ? 'archiveGuard.resolveButtonTrash' : 'archiveGuard.resolveButtonArchive')}
          </button>
        </div>
      </div>
    </>
  )
}
