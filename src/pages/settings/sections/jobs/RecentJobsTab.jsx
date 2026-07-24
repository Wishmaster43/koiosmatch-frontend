/**
 * RecentJobsTab — Taakbeheer → Recent (TAAKBEHEER-HORIZON-1 fase 1): the jobs
 * Horizon just processed (completed/failed/in-flight), tenant-tag-filterable —
 * "Horizon per tenant" (Danny 24-07: 284 geocodes ran fine but were invisible
 * on the board). Metadata only: job · queue · tenant · workflow · status · duur.
 * Horizon trims this window (~1 hour) — long history stays with the workflow
 * runs + audit trail. Polls every 15s while the tab is visible.
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Search } from 'lucide-react'
import api from '@/lib/api'
import StatusPill from '@/components/ui/StatusPill'
import { formatDuration } from '@/components/reports/runFormat'
import { BTN_H } from '@/config/buttonMetrics'

const STATUS_COLOR = {
  completed: 'var(--color-success)', failed: 'var(--color-danger)',
  pending: 'var(--text-muted)', reserved: 'var(--color-warning)',
}

const TH = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const TD = { padding: '9px 12px', fontSize: 12.5, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)' }

export default function RecentJobsTab() {
  const { t } = useTranslation('settings')
  const [rows, setRows] = useState([])
  const [phase, setPhase] = useState('loading')
  const [tenant, setTenant] = useState('')
  const [jobSearch, setJobSearch] = useState('')

  const load = useCallback(async () => {
    setPhase(p => (p === 'ready' ? 'ready' : 'loading'))
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (tenant) params.set('tenant', tenant)
      if (jobSearch) params.set('job', jobSearch)
      const res = await api.get(`/admin/jobs/recent?${params}`)
      setRows(res.data?.data ?? [])
      setPhase('ready')
    } catch {
      setPhase('error')
    }
  }, [tenant, jobSearch])

  // Initial + filter-driven load, then a 15s visible-tab poll (matches Overzicht).
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) load() }, 15000)
    return () => clearInterval(timer)
  }, [load])

  // Tenant options from the data itself — no extra endpoint needed.
  const tenants = useMemo(() => [...new Set(rows.map(r => r.tenant).filter(Boolean))].sort(), [rows])

  return (
    <div>
      {/* Toolbar: tenant filter + job search + refresh. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={tenant} onChange={e => setTenant(e.target.value)} aria-label={t('jobs.recent.tenantFilter')}
          style={{ height: BTN_H, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
          <option value="">{t('jobs.recent.allTenants')}</option>
          {tenants.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <Search size={12} color="var(--text-muted)" />
          <input value={jobSearch} onChange={e => setJobSearch(e.target.value)} placeholder={t('jobs.recent.jobSearch')}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: 'var(--text)', width: 160 }} />
        </div>
        <button type="button" onClick={load}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 10px', fontSize: 12,
            border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
          <RefreshCw size={12} className={phase === 'loading' ? 'animate-spin' : undefined} /> {t('jobs.refresh')}
        </button>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('jobs.recent.window')}</span>
      </div>

      {phase === 'error' && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('jobs.loadError')}</p>}
      {phase === 'ready' && rows.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>{t('jobs.recent.empty')}</p>}

      {rows.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto', background: 'var(--surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={TH}>{t('jobs.recent.colTime')}</th>
              <th style={TH}>{t('jobs.recent.colJob')}</th>
              <th style={TH}>{t('jobs.recent.colQueue')}</th>
              <th style={TH}>{t('jobs.recent.colTenant')}</th>
              <th style={TH}>{t('jobs.recent.colBy')}</th>
              <th style={TH}>{t('jobs.recent.colSubject')}</th>
              <th style={TH}>{t('jobs.recent.colWorkflow')}</th>
              <th style={TH}>{t('jobs.recent.colStatus')}</th>
              <th style={TH}>{t('jobs.recent.colDuration')}</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ ...TD, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    {r.completed_at ? new Date(r.completed_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                  </td>
                  <td style={{ ...TD, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{r.job}</td>
                  <td style={TD}>{r.queue}</td>
                  <td style={TD}>{r.tenant ?? '—'}</td>
                  {/* JOB-PROVENANCE-1: wie vroeg het aan + over welk record het gaat. */}
                  <td style={TD}>{r.requested_by ?? '—'}</td>
                  <td style={{ ...TD, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                    {r.subject ? `${r.subject.type} ${r.subject.reference}` : '—'}
                  </td>
                  <td style={TD}>{r.workflow ?? '—'}</td>
                  <td style={TD}><StatusPill label={t(`jobs.recent.status.${r.status}`, r.status)} color={STATUS_COLOR[r.status] ?? 'var(--text-muted)'} /></td>
                  <td style={{ ...TD, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{formatDuration(r.runtime_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
