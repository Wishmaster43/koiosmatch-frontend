/**
 * DrillDownDrawer — generic slide-in panel that lists the records behind a
 * chart/KPI data point (searchable). Reused by several reports.
 * StatusBadge below = the colored status pill.
 */
import { X, Search, Phone, Mail, Calendar, Briefcase, Clock, CalendarCheck, Maximize2, Minimize2, ArrowRight } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DrillTabs from '@/components/ui/DrillTabs'
import { navigateToPage } from '@/lib/navigate'
import type { ReportCandidate } from '@/types/reports'

// Colored status pill (actief / nietactief / extern / ...) for a record.
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
  const s = styles[key] || { bg: 'var(--hover-bg)', color: 'var(--text-muted)' }
  const label = status ? t(`candidates.status.${key}`, { defaultValue: status }) : t('candidates.unknown')
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0"
      style={{ background: s.bg, color: s.color }}>
      {label}
    </span>
  )
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function InfoRow({ icon: Icon, label, value, highlight }: { icon: LucideIcon; label: ReactNode; value?: ReactNode; highlight?: boolean }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={11} color={highlight ? 'var(--color-warning)' : 'var(--border)'} style={{ flexShrink: 0 }} />
      <span className="text-xs truncate">
        <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
        <span style={{ color: highlight ? 'var(--color-warning)' : 'var(--text-muted)', fontWeight: highlight ? 500 : 400 }}>
          {value}
        </span>
      </span>
    </div>
  )
}

export default function DrillDownDrawer({ title, subtitle, candidates = [], onClose, tabs, initialTab }: { title?: ReactNode; subtitle?: ReactNode; candidates?: ReportCandidate[]; onClose: () => void; tabs?: { key: string; label: ReactNode; candidates: ReportCandidate[]; title?: string }[]; initialTab?: string }) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation('reports')
  const [search, setSearch] = useState('')
  // Widen the panel to a two-column-friendly size (same affordance as the candidate drawer).
  const [expanded, setExpanded] = useState(false)
  // Optional bucket switcher (the shared DrillTabs standard) — e.g. the dashboard's
  // Gewerkt/Ingepland/Nooit gewerkt/Idle. Falls back to the flat `candidates` list.
  const [activeTab, setActiveTab] = useState(initialTab ?? tabs?.[0]?.key)
  const currentTab = tabs?.find(tb => tb.key === activeTab)
  const shown = currentTab?.candidates ?? candidates

  const filtered = shown.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      `${c.firstname} ${c.lastname}`.toLowerCase().includes(q) ||
      (c.position || '').toLowerCase().includes(q) ||
      (c.mobile   || '').includes(q)               ||
      (c.email    || '').toLowerCase().includes(q)
    )
  })

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      {/* Drawer */}
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-[var(--surface)]"
        style={{ width: expanded ? 900 : 560, transition: 'width 0.2s ease', boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div className="flex items-start justify-between flex-shrink-0"
          style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="font-semibold text-[var(--text)]" style={{ fontSize: 15 }}>{currentTab?.label ?? title}</div>
            <div className="text-sm text-[var(--text-muted)] mt-0.5">
              {t('drilldown.candidatesCount', { count: shown.length })}
              {subtitle && <span className="ml-1 text-[var(--text-muted)]">· {subtitle}</span>}
            </div>
          </div>
          {/* Expand/collapse + close — mirrors the candidate drawer header actions */}
          <div className="flex items-center flex-shrink-0" style={{ marginLeft: 12 }}>
            <button onClick={() => setExpanded(v => !v)} aria-label={expanded ? t('common:collapse') : t('common:expand')}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button onClick={onClose} aria-label={t('common:close')}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Bucket switcher (shared DrillTabs) — badge = count per bucket */}
        {tabs && tabs.length > 1 && activeTab && (
          <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: '1px solid var(--hover-bg)' }}>
            <DrillTabs tabs={tabs.map(tb => ({ key: tb.key, label: tb.label, count: tb.candidates.length, title: tb.title }))}
              active={activeTab} onChange={setActiveTab} />
          </div>
        )}

        {/* Search bar */}
        <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: '1px solid var(--hover-bg)' }}>
          <div className="flex items-center gap-2 px-3 rounded-lg"
            style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)' }}>
            <Search size={13} color="var(--text-muted)" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('drilldown.searchFull')}
              className="flex-1 py-2 text-[var(--text)] bg-transparent outline-none"
              style={{ border: 'none', fontSize: 12 }}
            />
          </div>
        </div>

        {/* Candidates list */}
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-[var(--text-muted)]">
              {t('candidates.empty')}
            </div>
          ) : (
            filtered.map((c, i) => {
              const initials       = `${c.firstname?.[0] || ''}${c.lastname?.[0] || ''}`.toUpperCase()
              const fullName       = `${c.firstname || ''} ${c.lastname || ''}`.trim()
              const isPlannedFuture = c.last_planned_shift && new Date(c.last_planned_shift) > new Date()

              return (
                <div key={c.id || i}
                  className="px-4 py-4 transition-colors"
                  style={{ borderBottom: '1px solid var(--hover-bg)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex items-center justify-center flex-shrink-0 font-medium rounded-full"
                      style={{ width: 36, height: 36, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 12 }}>
                      {initials || '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name + status */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-[var(--text)] truncate" style={{ fontSize: 13 }}>
                          {fullName || t('candidateDrawer.unknownName')}
                        </span>
                        <StatusBadge status={c.status} />
                      </div>

                      {/* Details grid */}
                      <div className="grid gap-1" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <InfoRow icon={Briefcase}    label={t('drilldown.fields.position')}     value={c.position} />
                        <InfoRow icon={Phone}        label={t('drilldown.fields.mobile')}       value={c.mobile} />
                        <InfoRow icon={Mail}         label={t('drilldown.fields.email')}        value={c.email} />
                        <InfoRow icon={Calendar}     label={t('drilldown.fields.registered')}   value={formatDate(c.registration_date)} />
                        <InfoRow icon={Clock}        label={t('drilldown.fields.lastLogin')}    value={formatDate(c.last_login_at)} />
                        <InfoRow
                          icon={CalendarCheck}
                          label={t('drilldown.fields.plannedOn')}
                          value={c.last_planned_shift ? formatDate(c.last_planned_shift) : t('drilldown.notPlanned')}
                          highlight={!isPlannedFuture}
                        />
                        <InfoRow icon={CalendarCheck} label={t('drilldown.fields.lastShift')}    value={formatDate(c.last_worked_shift)} />
                        <InfoRow icon={Clock}         label={t('drilldown.fields.shiftsWorked')} value={c.number_of_times_worked ?? null} />
                        {(c.no_show_count ?? 0) > 0 && (
                          <InfoRow icon={Clock} label={t('drilldown.fields.noShows')} value={c.no_show_count} highlight />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between flex-shrink-0 px-4 py-3"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--hover-bg)' }}>
          <span className="text-xs text-[var(--text-muted)]">
            {t('drilldown.shownOf', { shown: filtered.length, total: shown.length })}
          </span>
          <div className="flex items-center gap-2">
            {/* Jump to the standalone candidates table (closes the drawer first). */}
            <button onClick={() => { onClose(); navigateToPage('shiftmanager.candidates-table') }}
              className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5"
              style={{ background: 'var(--color-primary)', border: '1px solid var(--color-primary)', cursor: 'pointer', color: '#fff' }}>
              {t('drilldown.viewDetails')}
              <ArrowRight size={13} />
            </button>
            <button onClick={onClose} className="text-xs rounded-lg px-3 py-1.5"
              style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}>
              {t('dr.close')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}