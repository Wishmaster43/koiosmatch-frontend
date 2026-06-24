import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useCandidateCount } from '../../lib/queries'
import { useRightPanel } from '../../context/RightPanelContext'
import { useLookups } from '../../context/LookupsContext'
import api from '../../lib/api'
import PieChartCard from '../../components/charts/PieChartCard'
import BarChartCard from '../../components/charts/BarChartCard'
import LineChartCard from '../../components/charts/LineChartCard'
import WeeklyBarChartCard from '../../components/charts/WeeklyBarChartCard'
import { Users, CheckCircle, AlertCircle, Target, Euro } from 'lucide-react'

// Recent lists, AI runs and conversations are now live (GET /dashboard, C-30/C-31).
// The demo placeholder arrays were removed — data is mapped from the endpoint below.

// Turn a backend slug (status/funnel/stage value) into a readable label.
const humanize = (s) =>
  typeof s === 'string' && s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/[_-]/g, ' ') : (s ?? '—')

// Initials from a full name (max 2 letters), with a safe fallback.
const initialsOf = (name) =>
  (name || '').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '–'

// Compact "when": today → HH:mm, otherwise a short nl-NL date (e.g. "12 jun").
const fmtWhen = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

const eur = (v) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(v) || 0)

function KpiCard({ label, value, sub, color, bg, Icon, onClick }) {
  return (
    <div onClick={onClick}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '16px', cursor: onClick ? 'pointer' : 'default', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}

// Themed container that hosts a (theme-agnostic) chart card.
function Panel({ children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      {children}
    </div>
  )
}

function Block({ title, action, onAction, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        {action && <span style={{ fontSize: 12, color: 'var(--color-primary)', cursor: 'pointer' }} onClick={onAction}>{action} →</span>}
      </div>
      {children}
    </div>
  )
}

function Avatar({ initials, size = 28 }) {
  const colors = ['var(--color-primary)','var(--color-secondary)','var(--color-success)','var(--color-warning)','var(--color-danger)','#8B5CF6','#EC4899']
  const color  = colors[initials.charCodeAt(0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      fontSize: size * 0.36, fontWeight: 700 }}>
      {initials}
    </div>
  )
}

function StatusBadge({ label, color }) {
  return <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 99,
    background: color + '20', color, whiteSpace: 'nowrap' }}>{label}</span>
}

// Period filter options: backend enum value → Dutch label. Vestiging + status
// options now come live from GET /dashboard (filters.locations / filters.statuses).
const PERIODES = [
  ['vandaag', 'Vandaag'], ['week', 'Deze week'], ['maand', 'Deze maand'],
  ['kwartaal', 'Dit kwartaal'], ['jaar', 'Dit jaar'],
]

export default function Dashboard({ onNavigate }) {
  const { t } = useTranslation('dashboard')
  const { activeTenant } = useAuth()

  // Live total — same source as the Candidates table (/candidates meta.total).
  const { data: candidateTotal, isLoading: countLoading } = useCandidateCount()
  const candidateTotalLabel = countLoading ? '…' : (candidateTotal ?? 0).toLocaleString('nl-NL')

  // Live distributions/counts. /candidates/stats is live; /opportunities/stats
  // is best-effort (renders only if it returns). Defensive field readers mirror
  // the Candidates page (by_status→status, by_funnel→funnel_type, by_owner→owner_id).
  const [stats, setStats] = useState(null)
  const [opp,   setOpp]   = useState(null)
  // One call (C-30/C-31) for the extra KPIs, recent lists, the timeseries chart and
  // the module feeds (ai_runs / conversations). Returns the object directly (no wrapper).
  const [dash,  setDash]  = useState(null)
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/candidates/stats', { signal: ctrl.signal })
      .then(r => setStats(r.data?.data ?? r.data ?? null)).catch(() => {})
    api.get('/opportunities/stats', { signal: ctrl.signal })
      .then(r => setOpp(r.data?.data ?? r.data ?? null)).catch(() => setOpp(null))
    return () => ctrl.abort()
  }, [activeTenant?.id])

  // Status/funnel labels + colours come from the tenant lookups (NL, configurable)
  // — never humanised backend slugs. Mirrors how the Candidates page renders them.
  const { statusMeta, funnelMeta } = useLookups()

  // Chart data: [{ name, value, color }] for the shared chart cards.
  const statusData = useMemo(() =>
    (stats?.by_status ?? []).map(o => { const v = o.value ?? o.status; const m = statusMeta(v); return { name: m.label, value: o.count ?? 0, color: m.color, filterValue: v } }).filter(d => d.value), [stats, statusMeta])
  const recruiterData = useMemo(() =>
    (stats?.by_owner ?? []).map(o => ({ name: o.name || '—', value: o.count ?? 0, filterValue: o.id ?? o.owner_id })).filter(d => d.value), [stats])
  const funnelData = useMemo(() =>
    (dash?.charts?.by_funnel ?? []).map(o => ({ name: o.label, value: o.count ?? 0, color: o.color, filterValue: o.value })).filter(d => d.value), [dash])
  const oppStageData = useMemo(() =>
    (opp?.by_stage ?? []).map(o => ({ name: o.label ?? humanize(o.key), value: o.value ?? 0, color: o.color, filterValue: o.key })).filter(d => d.value), [opp])

  // Live feeds from GET /dashboard, mapped to the shapes the lists/charts render.
  // Status/stage labels + colours come from the tenant lookups (never raw slugs).
  const recentCandidates = useMemo(() => (dash?.recent?.candidates ?? []).map(c => {
    const m = statusMeta(c.status_value)
    return { name: c.name, initials: initialsOf(c.name), role: c.role || '—',
      status: m.label, statusColor: m.color, time: fmtWhen(c.last_activity_at) }
  }), [dash, statusMeta])

  const recentApplications = useMemo(() => (dash?.recent?.applications ?? []).map(a => {
    const m = funnelMeta(a.stage_value)
    return { candidate: a.candidate_name || '—', vacancy: a.vacancy_title || '—',
      status: m.label, statusColor: m.color, time: fmtWhen(a.created_at) }
  }), [dash, funnelMeta])

  const recentLeads = useMemo(() => (dash?.recent?.leads ?? []).map(l => ({
    name: l.name, contact: l.contact_name || '—',
    status: humanize(l.status_value), statusColor: 'var(--color-secondary)', time: fmtWhen(l.created_at),
  })), [dash])

  const runs = useMemo(() => (dash?.ai_runs ?? []).map(r => ({
    name: r.name || '—', time: fmtWhen(r.ran_at), ok: r.ok, n: r.processed, err: r.error,
  })), [dash])

  const conversations = useMemo(() => (dash?.conversations ?? []).map(c => ({
    name: c.name || '—', msg: c.last_message || '', time: fmtWhen(c.at),
  })), [dash])

  // Render the runs/conversations blocks on data presence — the backend already
  // gates these feeds per module (workflows/whatsapp), so this avoids a page-flag
  // mismatch hiding data a role legitimately has.
  const showRuns = runs.length > 0
  const showConv = conversations.length > 0

  // Weekly trend (C-31): merge the three aligned series (same buckets) into one row
  // per period for the grouped bar chart. Only series that have data are rendered.
  const trendData = useMemo(() => {
    const ts = dash?.charts?.timeseries ?? {}
    const byName = new Map()
    const add = (arr, key) => (arr ?? []).forEach(p => {
      const row = byName.get(p.name) ?? { name: p.name }
      row[key] = p.value ?? 0
      byName.set(p.name, row)
    })
    add(ts.candidates_in, 'kandidaten')
    add(ts.applications,  'sollicitaties')
    add(ts.matches,       'matches')
    return [...byName.values()]
  }, [dash])
  const trendSeries = useMemo(() => {
    const present = new Set()
    trendData.forEach(r => Object.keys(r).forEach(k => k !== 'name' && r[k] != null && present.add(k)))
    return [
      { key: 'kandidaten',    label: t('chart.series.candidates'),   color: 'var(--color-primary)' },
      { key: 'sollicitaties', label: t('chart.series.applications'), color: 'var(--color-secondary)' },
      { key: 'matches',       label: t('chart.series.matches'),      color: 'var(--color-accent)' },
    ].filter(s => present.has(s.key))
  }, [trendData, t])

  const att = stats?.attention ?? {}
  const num = (v) => (v == null ? '—' : Number(v).toLocaleString('nl-NL'))
  // Extract the filter value from a clicked chart datum (sector or legend item).
  const fv = (d) => (d && (d.filterValue ?? d.payload?.filterValue)) || undefined

  const [selPeriode,   setSelPeriode]   = useState([])
  const [selVestiging, setSelVestiging] = useState([])
  const [selStatus,    setSelStatus]    = useState([])
  const { registerFilters, unregisterFilters } = useRightPanel()

  const filterGroups = useMemo(() => [
    { key: 'periode', label: 'Periode', selected: selPeriode,
      options: PERIODES.map(([value, label]) => ({ value, label })),
      onToggle: v => setSelPeriode(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    { key: 'vestiging', label: 'Vestiging', selected: selVestiging,
      options: (dash?.filters?.locations ?? []).map(l => ({ value: l.id, label: l.name })),
      onToggle: v => setSelVestiging(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    { key: 'kandidaatstatus', label: 'Kandidaatstatus', selected: selStatus,
      options: (dash?.filters?.statuses ?? []).map(s => ({ value: s.value, label: s.label })),
      onToggle: v => setSelStatus(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
  ], [selPeriode, selVestiging, selStatus, dash])

  useEffect(() => {
    registerFilters('dashboard', filterGroups)
    return () => unregisterFilters('dashboard')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Refetch the summary whenever a filter changes. The dashboard is single-value per
  // dimension, so the first selected entry is sent (period enum / status slug / branch id).
  useEffect(() => {
    const ctrl = new AbortController()
    const params = {}
    if (selPeriode[0])   params.period = selPeriode[0]
    if (selStatus[0])    params.status = selStatus[0]
    if (selVestiging[0]) params.location_id = selVestiging[0]
    api.get('/dashboard', { params, signal: ctrl.signal })
      .then(r => setDash(r.data ?? null)).catch(() => {})
    return () => ctrl.abort()
  }, [activeTenant?.id, selPeriode, selVestiging, selStatus])

  // KPI strip — only metrics we have live data for (no faked numbers).
  const kpis = [
    { label: t('kpi.candidatesTotal'), value: candidateTotalLabel, sub: t('kpi.inAts'), color: 'var(--color-primary)', bg: 'var(--color-primary-bg)', Icon: Users, onClick: () => onNavigate?.('candidates') },
    { label: t('kpi.notContacted6m'), value: num(att.stale_6m), sub: t('kpi.attentionNeeded'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: AlertCircle, onClick: () => onNavigate?.('candidates', { attention: 'stale6m' }) },
    { label: t('kpi.neverContacted'), value: num(att.never_contacted), sub: t('kpi.attentionNeeded'), color: 'var(--color-danger)', bg: 'var(--color-danger-bg)', Icon: AlertCircle, onClick: () => onNavigate?.('candidates', { attention: 'neverContacted' }) },
    { label: t('kpi.openTasks'), value: num(att.tasks), sub: t('kpi.linkedToCandidates'), color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', Icon: CheckCircle, onClick: () => onNavigate?.('tasks', { status: 'open' }) },
    ...(opp ? [
      { label: t('kpi.opportunities'), value: num(opp.total), sub: t('kpi.openOpportunities'), color: '#8B5CF6', bg: '#F3E8FF', Icon: Target, onClick: () => onNavigate?.('opportunities', { stage: 'open' }) },
      { label: t('kpi.pipelineValue'), value: opp.pipeline_value != null ? eur(opp.pipeline_value) : '—', sub: t('kpi.sumOpenOpps'), color: 'var(--color-success)', bg: 'var(--color-success-bg)', Icon: Euro, onClick: () => onNavigate?.('opportunities', { stage: 'open' }) },
    ] : []),
  ]

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>

      {/* KPI-strip — live data */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Charts rij 1 — verdelingen uit /candidates/stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Panel><PieChartCard title={t('chart.byStatus')} data={statusData} colors={statusData.map(d => d.color)} onItemClick={(d) => onNavigate?.('candidates', fv(d) ? { status: fv(d) } : undefined)} /></Panel>
        <Panel><PieChartCard title={t('chart.byRecruiter')} data={recruiterData} onItemClick={(d) => onNavigate?.('candidates', fv(d) ? { owner: fv(d) } : undefined)} /></Panel>
      </div>

      {/* Charts rij 2 — funnel + (kansen indien beschikbaar) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Panel><BarChartCard title={t('chart.funnel')} data={funnelData} colors={funnelData.map(d => d.color)} showAverage onBarClick={(d) => onNavigate?.('applications', fv(d) ? { stage: fv(d) } : undefined)} /></Panel>
        <Panel>
          {opp
            ? <PieChartCard title={t('chart.byStage')} data={oppStageData} colors={oppStageData.map(d => d.color)} onItemClick={(d) => onNavigate?.('opportunities', fv(d) ? { stage: fv(d) } : undefined)} />
            : <LineChartCard title={t('chart.intakeOverTime')} data={[]} unit={t('common:units.candidates')} />}
        </Panel>
      </div>

      {/* Wekelijkse instroom — gegroepeerde bar: kandidaten · sollicitaties · matches (C-31). */}
      <div style={{ marginBottom: 16 }}>
        <Panel>
          <WeeklyBarChartCard title={t('chart.intakeWeekly')} data={trendData} series={trendSeries}
            onBarClick={(row, s) => {
              const page = s.key === 'sollicitaties' ? 'applications' : s.key === 'matches' ? 'matches' : 'candidates'
              onNavigate?.(page, row?.name ? { period: row.name } : undefined)
            }} />
        </Panel>
      </div>

      {/* Recente lijsten — demo-data tot er een feed is (B-22/C-30) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Block title={t('block.recentCandidates')} action={t('action.allCandidates')} onAction={() => onNavigate?.('candidates')}>
          {recentCandidates.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
              borderBottom: i < recentCandidates.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <Avatar initials={c.initials} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.role}</div>
              </div>
              <StatusBadge label={c.status} color={c.statusColor} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{c.time}</span>
            </div>
          ))}
        </Block>

        <Block title={t('block.recentApplications')} action={t('action.allApplications')} onAction={() => onNavigate?.('applications')}>
          {recentApplications.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
              borderBottom: i < recentApplications.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{a.candidate}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.vacancy}</div>
              </div>
              <StatusBadge label={a.status} color={a.statusColor} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{a.time}</span>
            </div>
          ))}
        </Block>
      </div>

      {/* Leads + (AI-runs / conversaties) — getoond op data-aanwezigheid (backend gate't per module) */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${1 + (showRuns ? 1 : 0) + (showConv ? 1 : 0)}, 1fr)`, gap: 16 }}>
        <Block title={t('block.leadsPipeline')} action={t('action.allCustomers')} onAction={() => onNavigate?.('customers')}>
          {recentLeads.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
              borderBottom: i < recentLeads.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{l.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.contact}</div>
              </div>
              <StatusBadge label={l.status} color={l.statusColor} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{l.time}</span>
            </div>
          ))}
        </Block>

        {showRuns && (
          <Block title={t('block.recentRuns')} action={t('action.all')} onAction={() => onNavigate?.('details.runs')}>
            {runs.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                borderBottom: i < runs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: r.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {r.ok ? <CheckCircle size={13} color="var(--color-success)" /> : <AlertCircle size={13} color="var(--color-danger)" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.ok ? t('run.processed', { count: r.n }) : r.err}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{r.time}</span>
              </div>
            ))}
          </Block>
        )}

        {showConv && (
          <Block title={t('block.recentConversations')} action={t('action.all')} onAction={() => onNavigate?.('details.messages')}>
            {conversations.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                borderBottom: i < conversations.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <Avatar initials={c.name.split(' ').map(n=>n[0]).join('')} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.msg}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{c.time}</span>
              </div>
            ))}
          </Block>
        )}
      </div>
    </div>
  )
}
