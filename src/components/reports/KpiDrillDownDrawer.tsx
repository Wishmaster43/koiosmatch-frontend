/**
 * KpiDrillDownDrawer — slide-in panel that explains a KPI: its target (from
 * useKpiSettings), the actual value, and the records behind it. Opened by
 * clicking a KPI card. Month names are derived from the active locale.
 */
import { X, Search, TrendingUp, Target, Info } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useKpiSettings } from '../../lib/useKpiSettings'
import type { ReportCandidate } from '../../types/reports'

// Locale-aware full month name for index 0–11.
const monthName = (i: number) => new Date(2000, i, 1).toLocaleString('nl-NL', { month: 'long' })

function StatusBadge({ status }: { status?: string }) {
  const { t } = useTranslation('reports')
  const styles: Record<string, { bg: string; color: string }> = {
    actief:     { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
    nietactief: { bg: 'var(--color-warning-bg)', color: '#C2410C' },
    extern:     { bg: 'var(--color-secondary-bg)', color: '#1D4ED8' },
    intake:     { bg: '#FAF5FF', color: '#7C3AED' },
    verwijderd: { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
  }
  const key = (status || '').toLowerCase()
  const s   = styles[key] || { bg: 'var(--hover-bg)', color: 'var(--text-muted)' }
  const label = status ? t(`candidates.status.${key}`, { defaultValue: status }) : t('candidates.unknown')
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 999,
                   padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>
      {label}
    </span>
  )
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Candidate list (New / Deregistered) ───────────────────────────────────────

function CandidateList({ candidates, dateField, dateLabel }: { candidates: ReportCandidate[]; dateField: string; dateLabel: string }) {
  const { t } = useTranslation('reports')
  const [search, setSearch] = useState('')

  const filtered = candidates.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${c.firstname ?? ''} ${c.lastname ?? ''}`.toLowerCase().includes(q) ||
           (c.position ?? '').toLowerCase().includes(q) ||
           (c.email    ?? '').toLowerCase().includes(q)
  })

  return (
    <>
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--hover-bg)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                      background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 7 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('drilldown.searchShort')}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12 }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: 100, fontSize: 13, color: 'var(--text-muted)' }}>
            {t('candidates.empty')}
          </div>
        )}
        {filtered.map((c, i) => {
          const name    = `${c.firstname ?? ''} ${c.lastname ?? ''}`.trim() || t('candidateDrawer.unknownName')
          const initials = `${c.firstname?.[0] ?? ''}${c.lastname?.[0] ?? ''}`.toUpperCase()
          const dateValue = c[dateField] as string | undefined
          return (
            <div key={c.id ?? i}
              style={{ padding: '10px 16px', borderBottom: '1px solid var(--hover-bg)',
                       display: 'flex', alignItems: 'center', gap: 10 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 600 }}>
                {initials || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{name}</span>
                  <StatusBadge status={c.status} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {c.position && <span>{c.position}</span>}
                  {c.position && dateValue && <span> · </span>}
                  {dateValue && <span>{dateLabel}: {formatDate(dateValue)}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'var(--hover-bg)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drilldown.shownOf', { shown: filtered.length, total: candidates.length })}</span>
      </div>
    </>
  )
}

// ── Average explanation ───────────────────────────────────────────────────────

function AverageBreakdown({ candidates, KPI_TARGET }: { candidates: ReportCandidate[]; KPI_TARGET: number }) {
  const { t } = useTranslation('reports')
  const now          = new Date()
  const currentMonth = now.getMonth()
  const currentYear  = now.getFullYear()

  // Build a per-month table for the current year
  const perMonth = Array.from({ length: 12 }, (_, i) => {
    const count = candidates.filter(c => {
      if (!c.registration_date) return false
      const d = new Date(c.registration_date)
      return d.getFullYear() === currentYear && d.getMonth() === i
    }).length
    return { month: i, label: monthName(i), count, isCurrent: i === currentMonth }
  })

  // Average: all months with data (excluding future months without data)
  const monthsWithData = perMonth.filter(m => m.month <= currentMonth)
  const totalNew       = monthsWithData.reduce((s, m) => s + m.count, 0)
  const avg            = monthsWithData.length
    ? Math.round(totalNew / monthsWithData.length)
    : 0

  const maxCount = Math.max(...perMonth.map(m => m.count), KPI_TARGET, 1)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

      {/* Formula explanation */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8,
                    background: '#F0F7FF', border: '1px solid #BFDBFE', marginBottom: 16 }}>
        <Info size={14} color="var(--color-secondary)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: '#1D4ED8', lineHeight: 1.5 }}>
          <strong>{t('drilldown.calcLabel')}</strong>{' '}
          {t('drilldown.calcBody', { year: currentYear, month: monthName(currentMonth).toLowerCase(), total: totalNew, months: monthsWithData.length, avg })}
          <br />{t('drilldown.kpiGoal', { target: KPI_TARGET })}
        </div>
      </div>

      {/* KPI summary blocks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: t('drilldown.newThisMonth'), value: perMonth[currentMonth].count,
            color: perMonth[currentMonth].count >= KPI_TARGET ? 'var(--color-success)' : perMonth[currentMonth].count >= avg ? 'var(--color-warning)' : 'var(--color-danger)' },
          { label: t('drilldown.avgPerMonthLabel'),  value: avg,   color: 'var(--text)' },
          { label: t('drilldown.kpiTargetLabel'),    value: KPI_TARGET, color: 'var(--color-primary)' },
        ].map(b => (
          <div key={b.label} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 8,
                                      background: 'var(--hover-bg)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: b.color, letterSpacing: '-0.5px' }}>
              {b.value}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{b.label}</div>
          </div>
        ))}
      </div>

      {/* Month-by-month table */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.05em', marginBottom: 8 }}>
        {t('drilldown.perMonthYear', { year: currentYear })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {perMonth.filter(m => m.month <= currentMonth).map(m => {
          const pct    = Math.round((m.count / maxCount) * 100)
          const atKpi  = m.count >= KPI_TARGET
          const barColor = atKpi ? 'var(--color-success)' : m.count >= avg ? 'var(--color-warning)' : 'var(--color-danger)'
          return (
            <div key={m.month} style={{
              padding: '7px 10px', borderRadius: 7,
              background: m.isCurrent ? '#F0F9FF' : 'var(--hover-bg)',
              border: `1px solid ${m.isCurrent ? '#BAE6FD' : 'var(--border)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 70, fontSize: 12, color: m.isCurrent ? '#0369A1' : 'var(--text)',
                                fontWeight: m.isCurrent ? 600 : 400 }}>
                  {m.label.slice(0, 3)}
                  {m.isCurrent && <span style={{ fontSize: 10, marginLeft: 4, color: '#0369A1' }}>▶</span>}
                </span>
                <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: barColor,
                                borderRadius: 999, transition: 'width 0.3s' }} />
                </div>
                <span style={{ width: 24, textAlign: 'right', fontSize: 12,
                               fontWeight: 600, color: barColor }}>
                  {m.count}
                </span>
                {/* KPI indicator */}
                <span style={{ width: 40, textAlign: 'right', fontSize: 10,
                               color: atKpi ? 'var(--color-success)' : 'var(--text-muted)' }}>
                  {atKpi ? t('drilldown.atKpi') : `${m.count}/${KPI_TARGET}`}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* KPI line explanation */}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 11, color: 'var(--text-muted)' }}>
        <Target size={11} color="var(--color-primary)" />
        {t('drilldown.kpiGoalFoot', { target: KPI_TARGET })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function KpiDrillDownDrawer({ mode, title, candidates = [], onClose }: { mode: string; title?: ReactNode; candidates?: ReportCandidate[]; onClose: () => void }) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation('reports')
  const { new_candidates_target: KPI_TARGET } = useKpiSettings()
  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-[var(--surface)]"
        style={{ width: 520, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{title}</div>
            {mode !== 'average' && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {t('drilldown.candidatesCount', { count: candidates.length })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {mode !== 'average' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                            borderRadius: 6, background: '#F0F7FF', border: '1px solid #BFDBFE' }}>
                <TrendingUp size={11} color="var(--color-secondary)" />
                <span style={{ fontSize: 11, color: 'var(--color-secondary)', fontWeight: 500 }}>
                  {t('drilldown.kpiPerMonth', { target: KPI_TARGET })}
                </span>
              </div>
            )}
            <button onClick={onClose}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Content */}
        {mode === 'average' ? (
          <AverageBreakdown candidates={candidates} KPI_TARGET={KPI_TARGET} />
        ) : (
          <CandidateList
            candidates={candidates}
            dateField={mode === 'uitgeschreven' ? 'end_date_employment' : 'registration_date'}
            dateLabel={mode === 'uitgeschreven' ? t('drilldown.deregistered') : t('drilldown.registered')}
          />
        )}
      </div>
    </>
  )
}
