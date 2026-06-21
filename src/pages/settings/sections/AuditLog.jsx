/**
 * AuditLog — tenant audit log with a drill-down drawer (before/after diff).
 * (Internal helpers DiffRow/AuditDrawer/LogBadge live in this file.)
 * Colours live in the *_META maps below; all labels are translated via t('audit.*').
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X, Download } from 'lucide-react'
import api from '../../../lib/api'
import { useRightPanel } from '../../../context/RightPanelContext'

// Log type → badge colour. Label = t('audit.logName.<key>').
const LOG_NAME_META = {
  auth:      { bg: 'var(--color-secondary-bg)', color: '#1D4ED8' },
  http:      { bg: '#F1F5F9', color: '#475569' },
  sync:      { bg: 'var(--color-secondary-bg)', color: 'var(--color-secondary)' },
  roles:     { bg: '#F5F3FF', color: '#6D28D9' },
  settings:  { bg: '#ECFDF5', color: '#059669' },
  users:     { bg: '#FFF7ED', color: '#C2410C' },
  apps:      { bg: '#FFF7ED', color: '#B45309' },
  modules:   { bg: '#F5F3FF', color: '#7C3AED' },
  workflows: { bg: '#ECFDF5', color: '#0F766E' },
  webhooks:  { bg: '#F0F9FF', color: '#0369A1' },
  ai:        { bg: '#FDF4FF', color: '#9333EA' },
}

// Settings keys shown in diffs — known KPI keys get a friendly label via t('audit.kpi.*').
const KPI_KEYS = ['new_candidates_target', 'churn_warning_threshold', 'avg_candidates_window', 'occupancy_target', 'response_rate_target']

function DiffRow({ label, before, after }) {
  const { t } = useTranslation('settings')
  const changed = JSON.stringify(before) !== JSON.stringify(after)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 8,
                  padding: '7px 0', borderBottom: '1px solid #F9FAFB', alignItems: 'start' }}>
      <span style={{ fontSize: 12, color: '#9CA3AF' }}>{label}</span>
      <div style={{ fontSize: 12, background: changed ? '#FEF2F2' : '#F9FAFB',
                    borderRadius: 6, padding: '3px 8px', color: changed ? 'var(--color-danger)' : '#6B7280' }}>
        {Array.isArray(before) ? (before.length ? before.join(', ') : t('audit.none')) : String(before ?? '—')}
      </div>
      <div style={{ fontSize: 12, background: changed ? '#F0FDF4' : '#F9FAFB',
                    borderRadius: 6, padding: '3px 8px', color: changed ? 'var(--color-success)' : '#6B7280' }}>
        {Array.isArray(after)  ? (after.length  ? after.join(', ')  : t('audit.none')) : String(after  ?? '—')}
      </div>
    </div>
  )
}

function AuditDrawer({ entry, onClose }) {
  const { t } = useTranslation('settings')
  const p = entry.properties ?? {}
  const logName = entry.log_name
  const kpiLabel = (k) => KPI_KEYS.includes(k) ? t(`audit.kpi.${k}`) : k

  const renderContent = () => {
    if (logName === 'http') {
      const method  = p.method ?? '—'
      const status  = p.status
      const isOk    = status >= 200 && status < 300
      const isErr   = status >= 400
      const statusColor = isOk ? 'var(--color-success)' : isErr ? 'var(--color-danger)' : 'var(--color-warning)'
      const statusBg    = isOk ? '#F0FDF4' : isErr ? '#FEF2F2' : 'var(--color-warning-bg)'
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px 16px', alignItems: 'start' }}>
            {[
              { label: t('audit.http.method'), value: method, mono: true },
              { label: t('audit.http.path'),   value: p.path ?? p.url ?? '—', mono: true },
              { label: t('audit.http.status'), value: status, statusColor, statusBg },
              { label: t('audit.http.duration'), value: p.duration ?? '—' },
            ].map(row => (
              <><span key={row.label + 'l'} style={{ fontSize: 12, color: '#9CA3AF', alignSelf: 'center' }}>{row.label}</span>
              <span key={row.label + 'v'} style={{ fontSize: 13, color: row.statusColor ?? '#111827',
                                  background: row.statusBg ?? 'transparent',
                                  borderRadius: row.statusBg ? 6 : 0,
                                  padding: row.statusBg ? '1px 7px' : 0,
                                  fontFamily: row.mono ? 'monospace' : 'inherit',
                                  fontWeight: row.statusColor ? 700 : 400 }}>
                {row.value ?? '—'}
              </span></>
            ))}
          </div>
          {p.payload && Object.keys(p.payload).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 6 }}>{t('audit.http.payload')}</div>
              <pre style={{ fontSize: 11, fontFamily: 'monospace', background: '#1E1E2E', color: '#A8E6CF',
                             borderRadius: 8, padding: '10px 14px', overflow: 'auto', maxHeight: 200,
                             margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(p.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )
    }

    if (logName === 'auth') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: t('audit.auth.action'),  value: p.action ?? entry.description },
            { label: t('audit.auth.ip'),      value: p.ip ?? p.ip_address ?? '—' },
            { label: t('audit.auth.browser'), value: p.user_agent ?? '—' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                           background: '#F9FAFB', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontSize: 13, color: '#6B7280' }}>{row.label}</span>
              <span style={{ fontSize: 13, color: '#111827', maxWidth: 240,
                              overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )
    }

    if (logName === 'sync') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: t('audit.sync.synced'),      value: p.synced ?? p.customers ?? p.candidates ?? '—', color: 'var(--color-success)' },
            { label: t('audit.sync.total'),       value: p.total ?? '—' },
            { label: t('audit.sync.errors'),      value: p.errors ?? '0', color: p.errors > 0 ? 'var(--color-danger)' : undefined },
            { label: t('audit.sync.duration'),    value: p.duration ?? '—' },
            { label: t('audit.sync.locations'),   value: p.locations },
            { label: t('audit.sync.departments'), value: p.departments },
          ].filter(r => r.value !== undefined && r.value !== null).map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        background: '#F9FAFB', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontSize: 13, color: '#6B7280' }}>{r.label}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: r.color ?? '#111827' }}>{r.value}</span>
            </div>
          ))}
        </div>
      )
    }

    if (logName === 'roles' && p.before !== undefined && p.after !== undefined) {
      const allPerms = [...new Set([...(p.before ?? []), ...(p.after ?? [])])].sort()
      const added    = (p.after ?? []).filter(x => !(p.before ?? []).includes(x))
      const removed  = (p.before ?? []).filter(x => !(p.after ?? []).includes(x))
      return (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 8,
                        padding: '6px 0', marginBottom: 4 }}>
            <span />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF' }}>{t('audit.before')}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF' }}>{t('audit.after')}</span>
          </div>
          {allPerms.map(perm => (
            <DiffRow key={perm} label={perm}
              before={(p.before ?? []).includes(perm) ? t('audit.active') : t('audit.inactive')}
              after={(p.after  ?? []).includes(perm) ? t('audit.active') : t('audit.inactive')} />
          ))}
          {(added.length > 0 || removed.length > 0) && (
            <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
              {added.length > 0 && (
                <div style={{ flex: 1, background: '#F0FDF4', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-success)', marginBottom: 6 }}>
                    {t('audit.addedCount', { count: added.length })}
                  </div>
                  {added.map(perm => <div key={perm} style={{ fontSize: 12, color: '#374151' }}>{perm}</div>)}
                </div>
              )}
              {removed.length > 0 && (
                <div style={{ flex: 1, background: '#FEF2F2', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-danger)', marginBottom: 6 }}>
                    {t('audit.removedCount', { count: removed.length })}
                  </div>
                  {removed.map(perm => <div key={perm} style={{ fontSize: 12, color: '#374151' }}>{perm}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    if (logName === 'settings') {
      if (p.before && p.after) {
        const changed = Object.keys(p.after).filter(k => String(p.before[k]) !== String(p.after[k]))
        const unchanged = Object.keys(p.after).filter(k => String(p.before[k]) === String(p.after[k]))
        return (
          <div>
            {changed.length > 0 && (
              <>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  {t('audit.changedCount', { count: changed.length })}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 8,
                              padding: '6px 0', marginBottom: 4 }}>
                  <span />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-danger)' }}>{t('audit.oldValue')}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-success)' }}>{t('audit.newValue')}</span>
                </div>
                {changed.map(k => (
                  <DiffRow key={k} label={kpiLabel(k)} before={p.before[k] ?? '—'} after={p.after[k]} />
                ))}
              </>
            )}
            {unchanged.length > 0 && (
              <details style={{ marginTop: 14 }}>
                <summary style={{ fontSize: 11, color: '#9CA3AF', cursor: 'pointer' }}>
                  {t('audit.unchangedCount', { count: unchanged.length })}
                </summary>
                <div style={{ marginTop: 8 }}>
                  {unchanged.map(k => (
                    <DiffRow key={k} label={kpiLabel(k)} before={p.before[k]} after={p.after[k]} />
                  ))}
                </div>
              </details>
            )}
          </div>
        )
      }
      const keys = p.keys ?? []
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
            {t('audit.settingsUpdated', { count: keys.length })}
          </p>
          {keys.map(k => (
            <div key={k} style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 12px',
                                   fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>{kpiLabel(k)}</div>
          ))}
        </div>
      )
    }

    // Generic fallback
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.entries(p).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', background: '#F9FAFB',
                                borderRadius: 8, padding: '8px 12px' }}>
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>{k}</span>
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>
              {Array.isArray(v) ? v.join(', ') : String(v)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.2)' }} onClick={onClose} />
      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-white"
        style={{ width: 480, boxShadow: '-4px 0 30px rgba(0,0,0,0.1)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <LogBadge logName={entry.log_name} />
                <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{entry.description}</span>
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                <strong style={{ color: '#374151' }}>{entry.causer_name ?? t('audit.system')}</strong>
                {entry.causer_email && <span> · {entry.causer_email}</span>}
                <span> · {new Date(entry.created_at).toLocaleString(undefined, {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}</span>
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {renderContent()}
        </div>
      </div>
    </>
  )
}

function LogBadge({ logName }) {
  const { t } = useTranslation('settings')
  const m = LOG_NAME_META[logName] ?? { bg: '#F3F4F6', color: '#6B7280' }
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
                   background: m.bg, color: m.color, whiteSpace: 'nowrap' }}>
      {t(`audit.logName.${logName}`, { defaultValue: logName })}
    </span>
  )
}

// Build the compact before/after cells shown in the table row.
function buildDiffCells(entry, t) {
  const p = entry.properties ?? {}
  const kpiLabel = (k) => KPI_KEYS.includes(k) ? t(`audit.kpi.${k}`) : k

  if (entry.log_name === 'roles') {
    if (p.before !== undefined && p.after !== undefined) {
      const removed = (p.before ?? []).filter(x => !(p.after ?? []).includes(x))
      const added   = (p.after  ?? []).filter(x => !(p.before ?? []).includes(x))
      return {
        beforeCell: removed.length ? removed.join(', ') : '—',
        afterCell:  added.length   ? added.join(', ')   : '—',
      }
    }
    if (p.name) return { beforeCell: '—', afterCell: p.name }
  }

  if (entry.log_name === 'settings') {
    if (p.before && p.after) {
      const changed = Object.keys(p.after).filter(k => String(p.before[k]) !== String(p.after[k]))
      if (!changed.length) return { beforeCell: '—', afterCell: t('audit.noChanges') }
      return {
        beforeCell: changed.map(k => `${kpiLabel(k)}: ${p.before[k] ?? '—'}`).join(' · '),
        afterCell:  changed.map(k => `${kpiLabel(k)}: ${p.after[k]}`).join(' · '),
      }
    }
    if (p.keys) return { beforeCell: '—', afterCell: t('audit.keysUpdated', { count: p.keys.length }) }
  }

  if (entry.log_name === 'sync') {
    return {
      beforeCell: '—',
      afterCell: [
        p.synced    != null && t('audit.cell.synced', { count: p.synced }),
        p.errors    != null && p.errors > 0 && t('audit.cell.errors', { count: p.errors }),
        p.duration  != null && p.duration,
      ].filter(Boolean).join(' · ') || '—',
    }
  }

  return { beforeCell: '—', afterCell: '—' }
}

export default function AuditLog() {
  const { t } = useTranslation('settings')
  const [logs,           setLogs]           = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [search,         setSearch]         = useState('')
  const [selectedTypes,  setSelectedTypes]  = useState([])
  const [selectedUsers,  setSelectedUsers]  = useState([])
  const [selectedRoles,  setSelectedRoles]  = useState([])
  const [dateFrom,       setDateFrom]       = useState('')
  const [dateTo,         setDateTo]         = useState('')
  const [drill,          setDrill]          = useState(null)
  const [visibleCount,   setVisibleCount]   = useState(50)

  const { registerFilters, unregisterFilters } = useRightPanel()

  useEffect(() => {
    api.get('/activity-log')
      .then(res => setLogs(res.data?.data ?? res.data ?? []))
      .catch(() => setError(t('audit.unavailable')))
      .finally(() => setLoading(false))
  }, [t])

  const typeOptions  = useMemo(() => [...new Set(logs.map(l => l.log_name).filter(Boolean))].sort(), [logs])
  const userOptions  = useMemo(() => [...new Set(logs.map(l => l.causer_name).filter(Boolean))].sort(), [logs])
  const roleOptions  = useMemo(() => [...new Set(
    logs.filter(l => l.log_name === 'roles')
        .map(l => l.properties?.role ?? l.properties?.name)
        .filter(Boolean)
  )].sort(), [logs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs.filter(l => {
      if (selectedTypes.length  && !selectedTypes.includes(l.log_name))    return false
      if (selectedUsers.length  && !selectedUsers.includes(l.causer_name)) return false
      if (selectedRoles.length) {
        const role = l.properties?.role ?? l.properties?.name
        if (!role || !selectedRoles.includes(role)) return false
      }
      if (dateFrom && new Date(l.created_at) < new Date(dateFrom))         return false
      if (dateTo   && new Date(l.created_at) > new Date(dateTo + 'T23:59:59')) return false
      if (!q) return true
      return (
        (l.description  ?? '').toLowerCase().includes(q) ||
        (l.causer_name  ?? '').toLowerCase().includes(q) ||
        (l.causer_email ?? '').toLowerCase().includes(q)
      )
    })
  }, [logs, search, selectedTypes, selectedUsers, selectedRoles, dateFrom, dateTo])

  // Reset the visible window whenever the filter set changes.
  useEffect(() => { setVisibleCount(50) }, [search, selectedTypes, selectedUsers, selectedRoles, dateFrom, dateTo])

  const filterGroups = useMemo(() => [
    {
      key: 'type', label: t('audit.filterType'),
      selected: selectedTypes,
      options: typeOptions.map(tp => ({
        value: tp, label: t(`audit.logName.${tp}`, { defaultValue: tp }),
        count: logs.filter(l => l.log_name === tp).length,
      })),
      onToggle: v => setSelectedTypes(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    },
    {
      key: 'user', label: t('audit.filterWho'),
      selected: selectedUsers,
      options: userOptions.map(u => ({
        value: u, label: u,
        count: logs.filter(l => l.causer_name === u).length,
      })),
      onToggle: v => setSelectedUsers(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    },
    ...(roleOptions.length > 0 ? [{
      key: 'role', label: t('audit.filterRole'),
      type: 'search-select',
      selected: selectedRoles,
      options: roleOptions.map(r => ({
        value: r, label: r,
        count: logs.filter(l => (l.properties?.role ?? l.properties?.name) === r).length,
      })),
      onToggle: v => setSelectedRoles(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    }] : []),
  ], [selectedTypes, selectedUsers, selectedRoles, typeOptions, userOptions, roleOptions, logs, t])

  useEffect(() => {
    registerFilters('audit-log', filterGroups)
    return () => unregisterFilters('audit-log')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Export the currently-filtered log to CSV (UTF-8 BOM for Excel; AVG accountability).
  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const who = (e) => e.causer_email
      ? `${e.causer_name ?? t('audit.system')} (${e.causer_email})`
      : (e.causer_name ?? t('audit.system'))
    const header = [t('audit.colDateTime'), t('audit.colWho'), t('audit.colType'), t('audit.colAction'), t('audit.colOldValue'), t('audit.colNewValue')]
    const rows = filtered.map(e => {
      const { beforeCell, afterCell } = buildDiffCells(e, t)
      return [new Date(e.created_at).toLocaleString('nl-NL'), who(e),
        t(`audit.logName.${e.log_name}`, { defaultValue: e.log_name }),
        e.description ?? '', beforeCell, afterCell]
    })
    const csv = '﻿' + [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const TH = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
               color: '#9CA3AF', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6',
               whiteSpace: 'nowrap' }
  const TD = { padding: '10px 12px', fontSize: 12, color: '#374151', borderBottom: '1px solid #F9FAFB',
               verticalAlign: 'top' }

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header + search bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{t('audit.title')}</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
            {loading ? t('audit.loading') : t('audit.countSummary', { shown: filtered.length, total: logs.length })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Date from */}
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ height: 34, padding: '0 10px', fontSize: 12, border: '1px solid #E5E7EB',
                     borderRadius: 8, color: '#374151', outline: 'none' }} />
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>{t('audit.dateTo')}</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ height: 34, padding: '0 10px', fontSize: 12, border: '1px solid #E5E7EB',
                     borderRadius: 8, color: '#374151', outline: 'none' }} />
          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%',
                                       transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('audit.searchPlaceholder')}
              style={{ height: 34, width: 220, paddingLeft: 28, paddingRight: 10, fontSize: 12,
                       border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', color: '#374151' }} />
          </div>
          {/* Export the filtered log to CSV (AVG accountability). */}
          <button onClick={exportCsv} disabled={filtered.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', fontSize: 12,
                     fontWeight: 500, border: '1px solid #E5E7EB', borderRadius: 8, background: 'white',
                     color: '#374151', cursor: filtered.length ? 'pointer' : 'not-allowed',
                     opacity: filtered.length ? 1 : 0.5, whiteSpace: 'nowrap' }}>
            <Download size={13} /> {t('audit.export')}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--color-warning-bg)',
                      border: '1px solid #FDE68A', fontSize: 13, color: '#92400E', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 130 }}>{t('audit.colDateTime')}</th>
                <th style={{ ...TH, width: 120 }}>{t('audit.colWho')}</th>
                <th style={{ ...TH, width: 120 }}>{t('audit.colType')}</th>
                <th style={{ ...TH, width: 180 }}>{t('audit.colAction')}</th>
                <th style={TH}>{t('audit.colOldValue')}</th>
                <th style={TH}>{t('audit.colNewValue')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...TD, textAlign: 'center', color: '#9CA3AF', padding: '32px 0' }}>
                    {t('audit.noEntries')}
                  </td>
                </tr>
              ) : filtered.slice(0, visibleCount).map((entry, i) => {
                const { beforeCell, afterCell } = buildDiffCells(entry, t)
                return (
                  <tr key={entry.id ?? i}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDrill(entry)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...TD, whiteSpace: 'nowrap', fontSize: 11 }}>
                      <div style={{ color: '#111827', fontWeight: 500 }}>
                        {new Date(entry.created_at).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                      <div style={{ color: '#9CA3AF', fontSize: 10 }}>
                        {new Date(entry.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td style={TD}>
                      <div style={{ fontWeight: 500, color: '#111827' }}>{entry.causer_name ?? t('audit.system')}</div>
                      {entry.causer_email && (
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>{entry.causer_email}</div>
                      )}
                    </td>
                    <td style={TD}><LogBadge logName={entry.log_name} /></td>
                    <td style={{ ...TD, fontWeight: 500, color: '#111827' }}>{entry.description}</td>
                    <td style={{ ...TD, fontSize: 11, color: 'var(--color-danger)' }}>{beforeCell}</td>
                    <td style={{ ...TD, fontSize: 11, color: 'var(--color-success)' }}>{afterCell}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Load-more pagination — reveal the next page of the filtered log. */}
      {!loading && !error && filtered.length > visibleCount && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <button onClick={() => setVisibleCount(c => c + 50)}
            style={{ height: 34, padding: '0 16px', fontSize: 12, fontWeight: 500, border: '1px solid #E5E7EB',
                     borderRadius: 8, background: 'white', color: '#374151', cursor: 'pointer' }}>
            {t('audit.loadMore', { count: Math.min(50, filtered.length - visibleCount) })}
          </button>
        </div>
      )}

      {drill && <AuditDrawer entry={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}
