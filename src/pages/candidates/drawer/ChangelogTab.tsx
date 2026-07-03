import { useTranslation } from 'react-i18next'
import { History, AlertTriangle, ArrowRight } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import SectionCard from '@/components/ui/SectionCard'
import { useDateFormat } from '@/lib/datetime'
import { initialsOf } from '@/lib/initials'
import { useCandidateActivity, type ActivityEvent } from '../hooks/useCandidateDrawerData'
import { useLookups } from '@/context/LookupsContext'
import type { Candidate } from '@/types/candidate'

// H2 status/phase provenance entry ({ axis, from, to, effective_from, … }) — the semantic
// transition log the backend already writes on every status/phase change (§3B).
interface H2Props { axis?: string; from?: string | null; to?: string | null; effective_from?: string | null; reason_given?: boolean; blacklist_reason?: string | null; available_again_date?: string | null }

// Backend field key → a readable label (dynamic keys aren't all translatable).
const humanizeField = (f: string) => f.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, c => c.toUpperCase())

// Per-field changes from a Spatie Activitylog properties bag ({ attributes, old }).
const changesOf = (ev: ActivityEvent): Array<{ field: string; old: unknown; next: unknown }> => {
  const attrs = ev.properties?.attributes
  if (!attrs || typeof attrs !== 'object') return []
  const old = (ev.properties?.old ?? {}) as Record<string, unknown>
  return Object.keys(attrs).map(field => ({ field, old: old[field], next: (attrs as Record<string, unknown>)[field] }))
}

/**
 * ChangelogTab — the candidate's audit trail (who changed what, when). Presentational:
 * the fetch (GET /candidates/{id}/activity, C-16) lives in useCandidateActivity (§3).
 * Handles the four UI states explicitly; shows a calm empty state until the backend
 * endpoint is live (404 → empty). `bare` drops the SectionCard so a popover can
 * supply its own chrome.
 */
export default function ChangelogTab({ c, bare = false }: { c: Candidate; bare?: boolean }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const { items, loading, error } = useCandidateActivity(c?.id)
  // Lookup meta so H2 transition values render as their tenant labels (not slugs).
  const { statusMeta, phaseMeta } = useLookups() as unknown as {
    statusMeta: (v: string) => { label: string }; phaseMeta: (v: string) => { label: string }
  }

  // One readable line for an H2 status/phase transition entry.
  const h2Line = (ev: ActivityEvent): string | null => {
    const p = ev.properties as H2Props | undefined
    if (!p?.axis || !p?.to) return null
    const meta = p.axis === 'phase' ? phaseMeta : statusMeta
    const label = (v?: string | null) => (v ? meta(v).label : t('changelog.emptyValue'))
    return [
      `${t(p.axis === 'phase' ? 'changelog.axisPhase' : 'changelog.axisStatus')}: ${label(p.from)} → ${label(p.to)}`,
      p.blacklist_reason,
      p.reason_given ? t('changelog.reasonGiven') : null,
      p.available_again_date ? t('drawer.availableAgain', { date: formatDate(p.available_again_date) }) : null,
      p.effective_from ? t('changelog.effectiveFrom', { date: formatDate(p.effective_from) }) : null,
    ].filter(Boolean).join(' · ')
  }

  // Render a before/after value calmly: empty → "Leeg", booleans → Yes/No.
  const fmtVal = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return t('changelog.emptyValue')
    if (typeof v === 'boolean') return v ? t('common:yes') : t('common:no')
    return String(v)
  }

  const body = (
    <>
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('changelog.loading')}</div>}

      {!loading && error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-danger)' }}>
          <AlertTriangle size={14} /> {t('changelog.error')}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0', color: 'var(--text-muted)', textAlign: 'center' }}>
          <History size={22} style={{ opacity: 0.5 }} />
          <span style={{ fontSize: 12 }}>{t('changelog.empty')}</span>
        </div>
      )}

      {!loading && !error && items.map((ev, i) => (
        <div key={ev.id ?? i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} />
          <Avatar initials={initialsOf(ev.causer_name)} size={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{ev.causer_name || t('changelog.system')}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{formatDate(ev.created_at)}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.description || ev.log_name}</div>
            {/* H2 provenance: "Status: Beschikbaar → Ziek · reden opgegeven · per 01-08-2026". */}
            {h2Line(ev) && <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 3 }}>{h2Line(ev)}</div>}
            {/* Field-level diffs (HelloFlex-style): one "field: old → new" row per change. */}
            {changesOf(ev).map(ch => (
              <div key={ch.field} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 3 }}>
                <span style={{ fontWeight: 500, color: 'var(--text)' }}>{humanizeField(ch.field)}</span>
                <span style={{ color: 'var(--text-muted)' }}>{fmtVal(ch.old)}</span>
                <ArrowRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text)' }}>{fmtVal(ch.next)}</span>
              </div>
            ))}
            {ev.ip && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{t('changelog.fromIp', { ip: ev.ip })}</div>}
          </div>
        </div>
      ))}
    </>
  )

  // Bare = caller supplies its own chrome (e.g. the changelog popover header).
  if (bare) return body
  return <SectionCard title={t('drawer.tabs.changelog')}>{body}</SectionCard>
}
