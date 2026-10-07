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
import { AlertTriangle } from 'lucide-react'
import SoftChip from '@/components/ui/SoftChip'
import FloatingPanel from '@/components/ui/FloatingPanel'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { FieldRow } from '@/components/forms/fields'
import { resolveApplication, resolveMatch } from '../data/archiveGuard'
import type { BlockingApplication, BlockingMatch } from '../data/archiveGuard'
import Button from '@/components/ui/Button'
import { BodyText, Caption, GroupLabel, PageTitle } from '@/components/ui/typography'
import { DEFAULT_FUNNEL_TYPES } from '@/context/LookupsContext'
import type { LookupItem } from '@/context/LookupsContext'
import { useRejectionReasons } from '@/lib/useRejectionReasons'

const sectionHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8,
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
  // The live tenant funnel lookup (HERAUDIT-2-REST-b) — resolveApplication reads
  // its is_rejected-flagged stage from here, never the seed default, so the PATCH
  // carries the tenant's actual renamed rejected-stage slug.
  funnelTypes?: LookupItem[]
  onClose: () => void
  // Called once every blocker resolved cleanly — the caller then proceeds.
  onResolved: () => void
}

// Blocks archive/prullenbak while a live application or active match still
// hangs on the candidate(s); "resolve all" walks each blocker before proceeding.
export default function ArchiveGuardModal({ mode, candidateName, aggregate, applications: initialApps, matches: initialMatches, funnelTypes = DEFAULT_FUNNEL_TYPES, onClose, onResolved }: Props) {
  const { t } = useTranslation(['candidates', 'common'])
  const { reasons, loading: reasonsLoading } = useRejectionReasons()
  const [reasonId, setReasonId] = useState<string>('')
  const [applications, setApplications] = useState(initialApps)
  const [matches, setMatches] = useState(initialMatches)
  const [appErrors, setAppErrors] = useState<Record<string, string>>({})
  const [matchErrors, setMatchErrors] = useState<Record<string, boolean>>({})
  const [resolving, setResolving] = useState(false)

  const hasBlockers = applications.length > 0 || matches.length > 0
  const anyConflict = Object.values(matchErrors).some(Boolean)
  // N012: a reason is required whenever there are applications to reject —
  // the resolve button stays disabled, with an honest reason, until picked.
  const reasonMissing = applications.length > 0 && !reasonId

  // N012: applications reject WITH the picked reason FIRST; only once every
  // one of them succeeds do matches get ended — a failed application must
  // never leave its matches already deleted underneath it. A failure stops
  // here (message shown per row) and leaves the matches untouched.
  const resolveAll = async () => {
    if (reasonMissing) return
    setResolving(true)
    if (applications.length > 0) {
      const appResults = await Promise.all(applications.map(a => resolveApplication(a.id, reasonId, funnelTypes)))
      const stillApps = applications.filter((_, i) => !appResults[i].ok)
      const errs: Record<string, string> = {}
      applications.forEach((a, i) => { if (!appResults[i].ok) errs[String(a.id)] = appResults[i].message || t('common:error.title') })
      setApplications(stillApps)
      setAppErrors(errs)
      if (stillApps.length) { setResolving(false); return }
    }

    const matchResults = await Promise.all(matches.map(m => resolveMatch(m.id)))
    const stillMatches = matches.filter((_, i) => !matchResults[i].ok)
    const errs: Record<string, boolean> = {}
    matches.forEach((m, i) => { if (!matchResults[i].ok) errs[String(m.id)] = matchResults[i].conflict })

    setMatches(stillMatches)
    setMatchErrors(errs)
    setResolving(false)
    if (!stillMatches.length) onResolved()
  }

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel — draggable header,
    // SE-resize, remembered position; the danger-icon title moves into the drag handle.
    <FloatingPanel open onClose={onClose} ariaLabel={t('archiveGuard.title')}
      persistKey="archive-guard" width={460} maxWidth="92vw" bodyStyle={{ padding: 22 }}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', background: 'var(--color-danger-bg)', color: 'var(--color-on-danger-bg)' }}><AlertTriangle size={16} /></span>
          <PageTitle as="span">{t('archiveGuard.title')}</PageTitle>
        </div>
      }>

        <BodyText style={{ marginBottom: 14 }}>
          {aggregate
            ? t('archiveGuard.bodyAggregate', { blocked: aggregate.blockedCount, total: aggregate.totalCount })
            : t('archiveGuard.body', { name: candidateName })}
        </BodyText>

        {applications.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={sectionHeader}>
              <GroupLabel as="span" style={{ letterSpacing: '0.04em' }}>{t('archiveGuard.applicationsTitle')}</GroupLabel>
              <span style={{ fontSize: 11.5, color: 'var(--color-danger-text)', fontWeight: 600 }}>{t('archiveGuard.resolutionReject')}</span>
            </div>
            {/* N012: the reason picked here travels on every application's PATCH
                below — one reason for the whole list, single or bulk mode alike. */}
            <FieldRow label={t('archiveGuard.rejectionReason')} required>
              <CreatableSelect allowCreate={false} clearable value={reasonId || null} onChange={v => setReasonId(v || '')}
                placeholder={reasonsLoading ? t('common:loading') : t('archiveGuard.rejectionReasonPlaceholder')}
                options={reasonsLoading ? [] : reasons.map(r => ({ value: r.value, label: r.label }))} />
            </FieldRow>
            {reasonMissing && <Caption style={{ color: 'var(--color-danger-text)', marginTop: 4, marginBottom: 8 }}>{t('archiveGuard.rejectionReasonRequired')}</Caption>}
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
              {applications.map((a, i) => (
                <div key={a.id} style={{ borderBottom: i === applications.length - 1 ? 'none' : '1px solid var(--border)' }}>
                  <div style={rowStyle(true)}>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.candidateName && <strong style={{ fontWeight: 600 }}>{a.candidateName} · </strong>}
                      {a.vacancyTitle}
                    </span>
                    <SoftChip label={a.stageLabel} color={a.stageColor} />
                  </div>
                  {appErrors[String(a.id)] && (
                    <Caption as="div" style={{ padding: '0 12px 8px', color: 'var(--color-danger-text)' }}>{t('archiveGuard.applicationFailed', { message: appErrors[String(a.id)] })}</Caption>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {matches.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={sectionHeader}>
              <GroupLabel as="span" style={{ letterSpacing: '0.04em' }}>{t('archiveGuard.matchesTitle')}</GroupLabel>
              <span style={{ fontSize: 11.5, color: 'var(--color-danger-text)', fontWeight: 600 }}>{t('archiveGuard.resolutionEndMatch')}</span>
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
                    <Caption as="div" style={{ padding: '0 12px 8px', color: 'var(--color-danger-text)' }}>{t('archiveGuard.matchConflict')}</Caption>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {anyConflict && (
          <Caption as="p" style={{ color: 'var(--color-danger-text)', marginBottom: 10 }}>{t('archiveGuard.stillBlocked')}</Caption>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button variant="danger" onClick={resolveAll} disabled={resolving || !hasBlockers || reasonMissing}>
            {resolving ? t('archiveGuard.resolving') : t(mode === 'trash' ? 'archiveGuard.resolveButtonTrash' : 'archiveGuard.resolveButtonArchive')}
          </Button>
        </div>
    </FloatingPanel>
  )
}
