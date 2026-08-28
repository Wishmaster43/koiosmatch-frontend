/**
 * KpiDrillDownDrawer — slide-in panel that explains a KPI: its target (from
 * useKpiSettings), the actual value, and the records behind it. Opened by
 * clicking a KPI card. Month names are derived from the active locale.
 */
import { X, Search, TrendingUp, Target, Info } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { PageTitle, BodyText, Caption, GroupLabel } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import StatusPill from '@/components/ui/StatusPill'
import { tint, tintBorder } from '@/lib/tint'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useKpiSettings } from '@/lib/useKpiSettings'
import CandidateDetailDrawer from './CandidateDetailDrawer'
import DrillTabs from '@/components/ui/DrillTabs'
import type { ReportCandidate } from '@/types/reports'
// App-wide active locale + the house DD-MM-YYYY date formatter (DATUM-1/LANE-B).
import { useLocale, useDateFormat } from '@/lib/datetime'
import { SM_STATUS } from '@/lib/smStatus'

// Locale-aware full month name for index 0–11; `locale` is required (a pure
// module-scope helper never hardcodes nl-NL or imports i18n).
const monthName = (locale: string, i: number) => new Date(2000, i, 1).toLocaleString(locale, { month: 'long' })

// A colour-tinted status pill for a drilldown row, via the shared SoftChip/StatusPill
// (KPIDRILL-CHROME-1) — the tint/ink pairing (incl. the danger-on-danger AA fix) now
// lives once in SoftChip/chipInk instead of a local hand-rolled bg/color map.
function StatusBadge({ status }: { status?: string }) {
  const { t } = useTranslation('reports')
  const colors: Record<string, string> = {
    [SM_STATUS.ACTIVE]: 'var(--color-success)',
    [SM_STATUS.INACTIVE]: 'var(--color-warning)',
    extern: 'var(--color-secondary)',
    [SM_STATUS.INTAKE]: 'var(--color-violet)',
    [SM_STATUS.DELETED]: 'var(--color-danger)',
  }
  const key = (status || '').toLowerCase()
  const label = status ? t(`candidates.status.${key}`, { defaultValue: status }) : t('candidates.unknown')
  return <StatusPill label={label} color={colors[key]} />
}

// ── Candidate list (New / Deregistered) ───────────────────────────────────────

function CandidateList({ candidates, dateField, dateLabel, onSelect }: { candidates: ReportCandidate[]; dateField: string; dateLabel: string; onSelect?: (c: ReportCandidate) => void }) {
  const { t } = useTranslation('reports')
  // House DD-MM-YYYY formatter (DATUM-1) — never a locale-shaped date string.
  const { formatDate } = useDateFormat()
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
              role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined}
              onClick={onSelect ? () => onSelect(c) : undefined}
              onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c) } } : undefined}
              style={{ padding: '10px 16px', borderBottom: '1px solid var(--hover-bg)',
                       display: 'flex', alignItems: 'center', gap: 10, cursor: onSelect ? 'pointer' : 'default' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 600 }}>
                {initials || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <BodyText as="span" style={{ fontWeight: 500 }}>{name}</BodyText>
                  <StatusBadge status={c.status} />
                </div>
                <Caption as="div">
                  {c.position && <span>{c.position}</span>}
                  {c.position && dateValue && <span> · </span>}
                  {dateValue && <span>{dateLabel}: {formatDate(dateValue)}</span>}
                </Caption>
                {/* Activity meta — times worked + last login (SM candidate fields) */}
                {(() => {
                  const sm = c as { number_of_times_worked?: number; last_login_at?: string }
                  const worked = sm.number_of_times_worked
                  const login  = sm.last_login_at
                  if (worked == null && !login) return null
                  return (
                    <Caption as="div" style={{ marginTop: 1 }}>
                      {worked != null && <span>{t('drilldown.timesWorked', { n: worked })}</span>}
                      {worked != null && login && <span> · </span>}
                      {login && <span>{t('drilldown.lastLogin')}: {formatDate(login)}</span>}
                    </Caption>
                  )
                })()}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'var(--hover-bg)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Caption as="span">{t('drilldown.shownOf', { shown: filtered.length, total: candidates.length })}</Caption>
      </div>
    </>
  )
}

// ── Average explanation ───────────────────────────────────────────────────────

function AverageBreakdown({ candidates, KPI_TARGET, onSelect }: { candidates: ReportCandidate[]; KPI_TARGET: number; onSelect?: (c: ReportCandidate) => void }) {
  const { t } = useTranslation('reports')
  const locale = useLocale()
  // House DD-MM-YYYY formatter (DATUM-1) — never a locale-shaped date string.
  const { formatDate } = useDateFormat()
  const now          = new Date()
  const currentMonth = now.getMonth()
  const currentYear  = now.getFullYear()
  // Click a month (or the 'Nieuw' block) to list that month's candidates below (Danny).
  const [selMonth, setSelMonth] = useState(currentMonth)
  const monthCandidates = candidates.filter(c => {
    if (!c.registration_date) return false
    const d = new Date(c.registration_date)
    return d.getFullYear() === currentYear && d.getMonth() === selMonth
  })

  // Build a per-month table for the current year
  const perMonth = Array.from({ length: 12 }, (_, i) => {
    const count = candidates.filter(c => {
      if (!c.registration_date) return false
      const d = new Date(c.registration_date)
      return d.getFullYear() === currentYear && d.getMonth() === i
    }).length
    return { month: i, label: monthName(locale, i), count, isCurrent: i === currentMonth }
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
                    background: 'var(--color-secondary-bg)', border: tintBorder('var(--color-secondary)'), marginBottom: 16 }}>
        <Info size={14} color="var(--color-secondary)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: 'var(--color-secondary)', lineHeight: 1.5 }}>
          <strong>{t('drilldown.calcLabel')}</strong>{' '}
          {t('drilldown.calcBody', { year: currentYear, month: monthName(locale, currentMonth).toLowerCase(), total: totalNew, months: monthsWithData.length, avg })}
          <br />{t('drilldown.kpiGoal', { target: KPI_TARGET })}
        </div>
      </div>

      {/* KPI summary blocks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: t('drilldown.newThisMonth'), value: perMonth[currentMonth].count,
            // Text ink on the neutral card bg: the -text twins, never the raw fill tokens.
            color: perMonth[currentMonth].count >= KPI_TARGET ? 'var(--color-success-text)' : perMonth[currentMonth].count >= avg ? 'var(--color-warning-text)' : 'var(--color-danger-text)',
            onClick: () => setSelMonth(currentMonth) },
          { label: t('drilldown.avgPerMonthLabel'),  value: avg,   color: 'var(--text)' },
          { label: t('drilldown.kpiTargetLabel'),    value: KPI_TARGET, color: 'var(--color-primary-text)' },
        ].map(b => {
          const clickable = 'onClick' in b && typeof b.onClick === 'function'
          return (
            <div key={b.label} onClick={clickable ? b.onClick : undefined}
              role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
              style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 8, cursor: clickable ? 'pointer' : 'default',
                background: 'var(--hover-bg)', border: `1px solid ${clickable && selMonth === currentMonth ? 'var(--color-primary)' : 'var(--border)'}` }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: b.color, letterSpacing: '-0.5px' }}>
                {b.value}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{b.label}</div>
            </div>
          )
        })}
      </div>

      {/* Month-by-month table */}
      <GroupLabel style={{ marginBottom: 8 }}>
        {t('drilldown.perMonthYear', { year: currentYear })}
      </GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {perMonth.filter(m => m.month <= currentMonth).map(m => {
          const pct    = Math.round((m.count / maxCount) * 100)
          const atKpi  = m.count >= KPI_TARGET
          // Bar fill stays the raw semantic token; text ink on the row reads the -text twin.
          const barColor = atKpi ? 'var(--color-success)' : m.count >= avg ? 'var(--color-warning)' : 'var(--color-danger)'
          const barInk = atKpi ? 'var(--color-success-text)' : m.count >= avg ? 'var(--color-warning-text)' : 'var(--color-danger-text)'
          const sel = selMonth === m.month
          return (
            <div key={m.month} onClick={() => setSelMonth(m.month)}
              role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelMonth(m.month) } }}
              style={{
                padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                background: sel ? 'var(--color-primary-bg)' : m.isCurrent ? 'var(--color-info-bg)' : 'var(--hover-bg)',
                border: `1px solid ${sel ? 'var(--color-primary)' : m.isCurrent ? tint('var(--color-info)', 33) : 'var(--border)'}`,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 70, fontSize: 12, color: m.isCurrent ? 'var(--color-info)' : 'var(--text)',
                                fontWeight: m.isCurrent ? 600 : 400 }}>
                  {m.label.slice(0, 3)}
                  {m.isCurrent && <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--color-info)' }}>▶</span>}
                </span>
                <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: barColor,
                                borderRadius: 999, transition: 'width 0.3s' }} />
                </div>
                <span style={{ width: 24, textAlign: 'right', fontSize: 12,
                               fontWeight: 600, color: barInk }}>
                  {m.count}
                </span>
                {/* KPI indicator */}
                <span style={{ width: 40, textAlign: 'right', fontSize: 10,
                               color: atKpi ? 'var(--color-success-text)' : 'var(--text-muted)' }}>
                  {atKpi ? t('drilldown.atKpi') : `${m.count}/${KPI_TARGET}`}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* KPI line explanation */}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Target size={11} color="var(--color-primary)" />
        <Caption as="span">{t('drilldown.kpiGoalFoot', { target: KPI_TARGET })}</Caption>
      </div>

      {/* Candidates of the selected month — click a month above to switch */}
      <div style={{ marginTop: 16 }}>
        <GroupLabel style={{ marginBottom: 8 }}>
          {monthName(locale, selMonth)} {currentYear} · {monthCandidates.length}
        </GroupLabel>
        {monthCandidates.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 2px' }}>{t('candidates.empty')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {monthCandidates.map((c, i) => {
              const name = `${c.firstname ?? ''} ${c.lastname ?? ''}`.trim() || t('candidateDrawer.unknownName')
              const ini  = `${c.firstname?.[0] ?? ''}${c.lastname?.[0] ?? ''}`.toUpperCase()
              return (
                <div key={c.id ?? i}
                  role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined}
                  onClick={onSelect ? () => onSelect(c) : undefined}
                  onKeyDown={onSelect ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c) } } : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 6, cursor: onSelect ? 'pointer' : 'default' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'var(--color-primary-bg)',
                                color: 'var(--color-primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>
                    {ini || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <BodyText as="div" style={{ fontWeight: 500 }}>{name}</BodyText>
                    <Caption as="div">
                      {c.position}{c.position && c.registration_date && ' · '}{c.registration_date && formatDate(c.registration_date)}
                    </Caption>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function KpiDrillDownDrawer({ mode, title, candidates = [], onClose, tabs, initialTab }: { mode: string; title?: ReactNode; candidates?: ReportCandidate[]; onClose: () => void; tabs?: { key: string; label: string; candidates: ReportCandidate[] }[]; initialTab?: string }) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation('reports')
  const { new_candidates_target: KPI_TARGET } = useKpiSettings()
  // Clicking a row opens that candidate's detail on top of the drill-down.
  const [selected, setSelected] = useState<ReportCandidate | null>(null)
  // Optional bucket switcher (Danny: switch between Nooit gewerkt / Gewerkt / …).
  const [activeTab, setActiveTab] = useState(initialTab ?? tabs?.[0]?.key)
  const currentTab = tabs?.find(tb => tb.key === activeTab)
  const shown = currentTab?.candidates ?? candidates
  return (
    <>
      <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.25)', zIndex: 'var(--z-drawer)' }} onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 flex flex-col bg-[var(--surface)]"
        style={{ width: 520, zIndex: 'var(--z-drawer)', boxShadow: 'var(--shadow-drawer)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <PageTitle as="div">{currentTab?.label ?? title}</PageTitle>
            {mode !== 'average' && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {t('drilldown.candidatesCount', { count: shown.length })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {mode !== 'average' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                            borderRadius: 6, background: 'var(--color-secondary-bg)', border: tintBorder('var(--color-secondary)') }}>
                <TrendingUp size={11} color="var(--color-secondary)" />
                <span style={{ fontSize: 11, color: 'var(--color-secondary)', fontWeight: 500 }}>
                  {t('drilldown.kpiPerMonth', { target: KPI_TARGET })}
                </span>
              </div>
            )}
            <Button variant="ghost" iconOnly onClick={onClose} aria-label={t('common:close')}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </Button>
          </div>
        </div>

        {/* Bucket switcher — the shared DrillTabs standard (chips + count badge) */}
        {tabs && tabs.length > 1 && activeTab && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--hover-bg)', flexShrink: 0 }}>
            <DrillTabs tabs={tabs.map(tb => ({ key: tb.key, label: tb.label, count: tb.candidates.length }))}
              active={activeTab} onChange={setActiveTab} />
          </div>
        )}

        {/* Content */}
        {mode === 'average' ? (
          <AverageBreakdown candidates={candidates} KPI_TARGET={KPI_TARGET} onSelect={setSelected} />
        ) : (
          <CandidateList
            candidates={shown}
            dateField={mode === 'uitgeschreven' ? 'end_date_employment' : 'registration_date'}
            dateLabel={mode === 'uitgeschreven' ? t('drilldown.deregistered') : t('drilldown.registered')}
            onSelect={setSelected}
          />
        )}
      </div>

      {selected && <CandidateDetailDrawer candidate={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
