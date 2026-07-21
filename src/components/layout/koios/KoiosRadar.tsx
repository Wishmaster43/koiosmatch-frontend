/**
 * KoiosRadar — "Koios Advies": the candidate attention signals the backend
 * already computes (/candidates/stats.attention), each a clickable deep-link
 * into the filtered candidates list. This IS the Koios panel's landing-state
 * content (Danny 21/7) — it replaces the generic welcome text, not sits next
 * to it — and disappears the moment a real conversation starts. Read-only,
 * no new data model; labels are reused verbatim from the candidates page's own
 * attention KPIs (candidateInsights.tsx) so the wording never drifts.
 */
import { useTranslation } from 'react-i18next'
import { CalendarCheck, Clock, UserX, CalendarX, MessageCircle, CheckSquare } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useKoiosRadarSignals } from './useKoiosRadarSignals'
import type { RadarSignalId } from './useKoiosRadarSignals'

// Teal accent for the "tasks" row — mirrors candidateInsights.tsx / applicationInsights.ts's
// identical documented TASKS_ACCENT (no matching design token for this hue yet, §4 gap).
// eslint-disable-next-line no-restricted-syntax -- no matching token hue close enough; tracked as a token-set follow-up (mirrors candidateInsights.tsx precedent)
const TASKS_ACCENT = '#0D9488'

// Icon + reused i18n key (candidates namespace, same labels as the candidates page's
// own attention KPI cards) + accent colour per signal, keyed by the same id
// useCandidateFilters' attentionFilter uses.
const SIGNAL_META: Record<RadarSignalId, { Icon: LucideIcon; labelKey: string; color: string }> = {
  intakePlanned:  { Icon: CalendarCheck, labelKey: 'candidates:kpi.intake',               color: 'var(--color-violet)' },
  stale6m:        { Icon: Clock,         labelKey: 'candidates:analytics.stale6m',        color: 'var(--color-warning)' },
  neverContacted: { Icon: UserX,         labelKey: 'candidates:analytics.neverContacted', color: 'var(--color-info)' },
  noFollowup:     { Icon: CalendarX,     labelKey: 'candidates:analytics.noFollowup',     color: 'var(--color-danger)' },
  activeConv:     { Icon: MessageCircle, labelKey: 'candidates:analytics.conversations',  color: 'var(--color-success)' },
  hasTasks:       { Icon: CheckSquare,   labelKey: 'candidates:kpi.tasks',                color: TASKS_ACCENT },
}

export default function KoiosRadar({ onNavigate }: { onNavigate?: (page: string, intent?: unknown) => void }) {
  const { t } = useTranslation(['common', 'candidates'])
  const { signals, loading, error } = useKoiosRadarSignals()

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
        {t('common:koios.radar.title')}
      </div>

      {/* Four explicit UI states: loading / error / empty / non-zero signal rows. */}
      {loading && (
        <p style={{ margin: 0, padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</p>
      )}
      {!loading && error && (
        <p style={{ margin: 0, padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{t('common:error.body')}</p>
      )}
      {!loading && !error && signals?.length === 0 && (
        <p style={{ margin: 0, padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{t('common:koios.radar.empty')}</p>
      )}
      {!loading && !error && signals && signals.length > 0 && (
        <div style={{ padding: '4px 0' }}>
          {signals.map(s => {
            const meta = SIGNAL_META[s.id]
            const Icon = meta.Icon
            const label = t(meta.labelKey)
            return (
              <button key={s.id} type="button"
                onClick={() => onNavigate?.('candidates', { attention: s.id })}
                aria-label={`${label}: ${s.count}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '7px 14px', background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', fontFamily: 'inherit', color: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  width: 22, height: 22, borderRadius: 6,
                  background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color,
                }}>
                  <Icon size={12} />
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: meta.color, fontFamily: 'var(--font-mono, monospace)' }}>
                  {s.count}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
