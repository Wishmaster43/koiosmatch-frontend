/**
 * AuditLog — tenant audit log with a drill-down drawer (before/after diff).
 * (Internal helpers DiffRow/AuditDrawer/LogBadge live in this file.)
 * Colours live in the *_META maps below; all labels are translated via t('audit.*').
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Download } from 'lucide-react'
import api from '../../../lib/api'
import { useRightPanel } from '../../../context/RightPanelContext'
import { KPI_KEYS, LogBadge } from './auditShared'
import { AuditDrawer } from './AuditDrawer'


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
