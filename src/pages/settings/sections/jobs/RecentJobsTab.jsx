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
import SearchSelect from '@/components/ui/SearchSelect'
import Button from '@/components/ui/Button'
import { Caption, Mono } from '@/components/ui/typography'
// House numeric shape (DATUM-1): digits only, so no locale is needed here.
import { hhmmss } from '@/lib/localDate'

const STATUS_COLOR = {
  completed: 'var(--color-success)', failed: 'var(--color-danger)',
  pending: 'var(--text-muted)', reserved: 'var(--color-warning)',
}

// Layout only — text identity (11px muted / mono) lives in the Caption/Mono
// atoms rendered inside these cells (HUISSTIJL-1: identity never re-declared locally).
const TH = { padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const TD = { padding: '9px 12px', fontSize: 12.5, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)' }

// Superadmin view of the jobs Horizon just processed, filterable by tenant/job, polling while the tab stays visible.
export default function RecentJobsTab() {
  const { t } = useTranslation('settings')
  const [rows, setRows] = useState([])
  const [phase, setPhase] = useState('loading')
  const [tenant, setTenant] = useState('')
  const [jobSearch, setJobSearch] = useState('')

  // Fetches the recent-jobs window with the current filters; keeps phase 'ready' during a background refresh so the table never flashes back to loading.
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
  // Polls every 15s while this tab is visible; skipped when the document is hidden to save requests.
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
        {/* Herhaal-audit r4 finding 7: SearchSelect's own default trigger face —
            was the app's own two-height inconsistency (this used BTN_H/34px while
            JobsTab's twin status filter used a hand-rolled 32px); both now share
            the one calm trigger footprint the atom owns. */}
        <SearchSelect
          options={[{ value: '', label: t('jobs.recent.allTenants') }, ...tenants.map(id => ({ value: id, label: id }))]}
          selected={[tenant]}
          onToggle={setTenant}
          closeOnToggle
          triggerLabel={tenant || t('jobs.recent.allTenants')}
          triggerAriaLabel={t('jobs.recent.tenantFilter')}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <Search size={12} color="var(--text-muted)" />
          <input value={jobSearch} onChange={e => setJobSearch(e.target.value)} placeholder={t('jobs.recent.jobSearch')}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: 'var(--text)', width: 160 }} />
        </div>
        <Button variant="secondary" size="sm" onClick={load}
          style={{ marginLeft: 'auto' }}>
          <RefreshCw size={12} className={phase === 'loading' ? 'animate-spin' : undefined} /> {t('jobs.refresh')}
        </Button>
        <Caption>{t('jobs.recent.window')}</Caption>
      </div>

      {phase === 'error' && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('jobs.loadError')}</p>}
      {phase === 'ready' && rows.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>{t('jobs.recent.empty')}</p>}

      {rows.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto', background: 'var(--surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={TH}><Caption style={{ fontWeight: 600 }}>{t('jobs.recent.colTime')}</Caption></th>
              <th style={TH}><Caption style={{ fontWeight: 600 }}>{t('jobs.recent.colJob')}</Caption></th>
              <th style={TH}><Caption style={{ fontWeight: 600 }}>{t('jobs.recent.colQueue')}</Caption></th>
              <th style={TH}><Caption style={{ fontWeight: 600 }}>{t('jobs.recent.colTenant')}</Caption></th>
              <th style={TH}><Caption style={{ fontWeight: 600 }}>{t('jobs.recent.colBy')}</Caption></th>
              <th style={TH}><Caption style={{ fontWeight: 600 }}>{t('jobs.recent.colSubject')}</Caption></th>
              <th style={TH}><Caption style={{ fontWeight: 600 }}>{t('jobs.recent.colWorkflow')}</Caption></th>
              <th style={TH}><Caption style={{ fontWeight: 600 }}>{t('jobs.recent.colStatus')}</Caption></th>
              <th style={TH}><Caption style={{ fontWeight: 600 }}>{t('jobs.recent.colDuration')}</Caption></th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ ...TD, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    {r.completed_at ? hhmmss(new Date(r.completed_at)) : '—'}
                  </td>
                  <td style={TD}><Mono style={{ fontSize: 12 }}>{r.job}</Mono></td>
                  <td style={TD}>{r.queue}</td>
                  <td style={TD}>{r.tenant ?? '—'}</td>
                  {/* JOB-PROVENANCE-1: who requested it + which record it concerns. */}
                  <td style={TD}>{r.requested_by ?? '—'}</td>
                  <td style={TD}>
                    <Mono style={{ fontSize: 12 }}>{r.subject ? `${r.subject.type} ${r.subject.reference}` : '—'}</Mono>
                  </td>
                  <td style={TD}>{r.workflow ?? '—'}</td>
                  <td style={TD}><StatusPill label={t(`jobs.recent.status.${r.status}`, r.status)} color={STATUS_COLOR[r.status] ?? 'var(--text-muted)'} /></td>
                  <td style={TD}><Mono style={{ fontSize: 12 }}>{formatDuration(r.runtime_ms)}</Mono></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
