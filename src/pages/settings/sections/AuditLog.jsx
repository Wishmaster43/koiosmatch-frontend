/**
 * AuditLog — tenant audit log with sticky header, pagination, sortable columns,
 * and date-range filter in the right filter panel.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, ChevronUp, ChevronDown as ChevronDn, Eye } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { escapeCsvCell } from '@/lib/csv'
import { useRightPanel } from '@/context/RightPanelContext'
import { KPI_KEYS, LogBadge, isAccessEvent, buildFieldDiff, entityLabel } from './auditShared'
import { AuditDrawer } from './AuditDrawer'
import PaginationBar from '@/components/ui/PaginationBar'

const PAGE_SIZE = 25

// Build the compact before/after cells shown in the table row. Special-cased log
// names (roles/settings/sync) carry their own bespoke `properties` shape; every
// other write event (candidate/vacancy/task/opportunity/match/customer/…) uses the
// uniform CHANGELOG-3 diff (`entry.changes`), generalised via buildFieldDiff so this
// table renders exactly what the per-entity changelog popovers show.
function buildDiffCells(entry, t) {
  const p = entry.properties ?? {}
  const kpiLabel = (k) => KPI_KEYS.includes(k) ? t(`audit.kpi.${k}`) : k

  if (entry.log_name === 'roles') {
    if (p.before !== undefined && p.after !== undefined) {
      const removed = (p.before ?? []).filter(x => !(p.after ?? []).includes(x))
      const added   = (p.after  ?? []).filter(x => !(p.before ?? []).includes(x))
      return { beforeCell: removed.length ? removed.join(', ') : '—', afterCell: added.length ? added.join(', ') : '—' }
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
        p.synced   != null && t('audit.cell.synced',   { count: p.synced }),
        p.errors   != null && p.errors > 0 && t('audit.cell.errors', { count: p.errors }),
        p.duration != null && p.duration,
      ].filter(Boolean).join(' · ') || '—',
    }
  }

  // Access (read) events never carry an old→new diff — the compliance log only
  // records WHO opened WHICH dossier, WHEN.
  if (isAccessEvent(entry)) return { beforeCell: '—', afterCell: '—' }

  // Generalised entity write (CHANGELOG-3): one compact "field: value" per changed
  // field, same field set/order as the per-entity changelog popover.
  const diffRows = buildFieldDiff(entry, t)
  if (diffRows.length) {
    return {
      beforeCell: diffRows.map(r => `${r.label}: ${r.before}`).join(' · '),
      afterCell:  diffRows.map(r => `${r.label}: ${r.after}`).join(' · '),
    }
  }

  return { beforeCell: '—', afterCell: '—' }
}

// Sort chevron indicator for a column header.
function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronDn size={10} style={{ opacity: 0.25, marginLeft: 3 }} />
  return sortDir === 'asc'
    ? <ChevronUp  size={10} style={{ color: 'var(--color-primary)', marginLeft: 3 }} />
    : <ChevronDn  size={10} style={{ color: 'var(--color-primary)', marginLeft: 3 }} />
}

export default function AuditLog() {
  const { t } = useTranslation('settings')
  const [logs,          setLogs]          = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [search,        setSearch]        = useState('')
  const [selectedTypes, setSelectedTypes] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [selectedRoles, setSelectedRoles] = useState([])
  // Actor-type filter: '' = all, 'user' = human causer, 'system' = automation/service (no email).
  const [selectedActor, setSelectedActor] = useState([])
  // Kind filter: 'change' (created/updated/deleted) vs 'access' (the AVG read log) —
  // the only distinguishing signal is `event`, since an access entry shares its
  // log_name with the entity's write events (Danny/CMBE: make access separately filterable).
  const [selectedKind,  setSelectedKind]  = useState([])
  const [dateFrom,      setDateFrom]      = useState('')
  const [dateTo,        setDateTo]        = useState('')
  const [drill,         setDrill]         = useState(null)
  const [sortCol,       setSortCol]       = useState('created_at')
  const [sortDir,       setSortDir]       = useState('desc')
  const [page,          setPage]          = useState(1)

  const { registerFilters, unregisterFilters } = useRightPanel()

  useEffect(() => {
    api.get('/activity-log')
      .then(res => setLogs(unwrapList(res).rows))
      .catch(() => setError(t('audit.unavailable')))
      .finally(() => setLoading(false))
  }, [t])

  const typeOptions  = useMemo(() => [...new Set(logs.map(l => l.log_name).filter(Boolean))].sort(), [logs])
  const userOptions  = useMemo(() => [...new Set(logs.map(l => l.causer_name).filter(Boolean))].sort(), [logs])
  const roleOptions  = useMemo(() => [...new Set(
    logs.filter(l => l.log_name === 'roles').map(l => l.properties?.role ?? l.properties?.name).filter(Boolean)
  )].sort(), [logs])

  // Apply all filters including date range.
  const filteredAll = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs.filter(l => {
      if (selectedTypes.length && !selectedTypes.includes(l.log_name))    return false
      if (selectedUsers.length && !selectedUsers.includes(l.causer_name)) return false
      if (selectedRoles.length) {
        const role = l.properties?.role ?? l.properties?.name
        if (!role || !selectedRoles.includes(role)) return false
      }
      if (selectedActor.length) {
        const actor = l.causer_email ? 'user' : 'system'
        if (!selectedActor.includes(actor)) return false
      }
      if (selectedKind.length && !selectedKind.includes(isAccessEvent(l) ? 'access' : 'change')) return false
      if (dateFrom && new Date(l.created_at) < new Date(dateFrom))                    return false
      if (dateTo   && new Date(l.created_at) > new Date(dateTo + 'T23:59:59'))        return false
      if (q) return (
        (l.description  ?? '').toLowerCase().includes(q) ||
        (l.causer_name  ?? '').toLowerCase().includes(q) ||
        (l.causer_email ?? '').toLowerCase().includes(q)
      )
      return true
    })
  }, [logs, search, selectedTypes, selectedUsers, selectedRoles, selectedActor, selectedKind, dateFrom, dateTo])

  // Sort the filtered list.
  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filteredAll].sort((a, b) => {
      if (sortCol === 'created_at') return dir * (new Date(a.created_at) - new Date(b.created_at))
      if (sortCol === 'causer_name') return dir * (a.causer_name ?? '').localeCompare(b.causer_name ?? '')
      if (sortCol === 'log_name')    return dir * (a.log_name    ?? '').localeCompare(b.log_name    ?? '')
      if (sortCol === 'description') return dir * (a.description ?? '').localeCompare(b.description ?? '')
      return 0
    })
  }, [filteredAll, sortCol, sortDir])

  // Reset page when filters change.
  useEffect(() => { setPage(1) }, [search, selectedTypes, selectedUsers, selectedRoles, selectedActor, selectedKind, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageRows   = useMemo(() => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [sorted, page])

  // Toggle sort column — same column flips direction, new column defaults to desc.
  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  // Register filter groups in the right filter panel — search, date-range, type, user, role.
  const filterGroups = useMemo(() => [
    {
      key: 'search', label: t('audit.searchPlaceholder'), type: 'global-search',
      value: search, onChange: setSearch,
    },
    {
      key: 'date', label: t('audit.filterDate'), type: 'date-range',
      from: dateFrom, to: dateTo,
      onFromChange: setDateFrom, onToChange: setDateTo,
      selected: [dateFrom, dateTo].filter(Boolean),
    },
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
      key: 'actor', label: t('audit.filterActor'), type: 'search-select',
      selected: selectedActor,
      options: [
        { value: 'user',   label: t('audit.actorUser'),   count: logs.filter(l => l.causer_email).length },
        { value: 'system', label: t('audit.actorSystem'), count: logs.filter(l => !l.causer_email).length },
      ],
      onToggle: v => setSelectedActor(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    },
    {
      // Separately filterable access-vs-change split (Danny/CMBE 2026-07-14).
      key: 'kind', label: t('audit.filterKind'), type: 'search-select',
      selected: selectedKind,
      options: [
        { value: 'change', label: t('audit.kind.change'), count: logs.filter(l => !isAccessEvent(l)).length },
        { value: 'access', label: t('audit.kind.access'), count: logs.filter(isAccessEvent).length },
      ],
      onToggle: v => setSelectedKind(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
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
      key: 'role', label: t('audit.filterRole'), type: 'search-select',
      selected: selectedRoles,
      options: roleOptions.map(r => ({
        value: r, label: r,
        count: logs.filter(l => (l.properties?.role ?? l.properties?.name) === r).length,
      })),
      onToggle: v => setSelectedRoles(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    }] : []),
  ], [selectedTypes, selectedUsers, selectedRoles, selectedActor, selectedKind, typeOptions, userOptions, roleOptions, logs, dateFrom, dateTo, t])

  useEffect(() => {
    registerFilters('audit-log', filterGroups)
    return () => unregisterFilters('audit-log')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Export the currently-filtered log to CSV (UTF-8 BOM for Excel; AVG accountability).
  // Cells go through the shared escapeCsvCell, which also guards against formula
  // injection (a leading =+-@ opened as a live formula in Excel/Sheets — C-14).
  const exportCsv = () => {
    const who = (e) => e.causer_email
      ? `${e.causer_name ?? t('audit.system')} (${e.causer_email})`
      : (e.causer_name ?? t('audit.system'))
    const header = [t('audit.colDate'), t('audit.colTime'), t('audit.colWho'), t('audit.colType'), t('audit.colEntity'), t('audit.colAction'), t('audit.colOldValue'), t('audit.colNewValue')]
    const rows = filteredAll.map(e => {
      const { beforeCell, afterCell } = buildDiffCells(e, t)
      const entityStr = e.subject_type ? entityLabel(e.subject_type, t) + (e.subject_label ? ` · ${e.subject_label}` : '') : ''
      return [
        new Date(e.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        new Date(e.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
        who(e),
        t(`audit.logName.${e.log_name}`, { defaultValue: e.log_name }),
        entityStr,
        e.description ?? '', beforeCell, afterCell]
    })
    const csv = '﻿' + [header, ...rows].map(r => r.map(escapeCsvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  // Sticky TH style — header stays visible while scrolling the table.
  const TH = (col) => ({
    padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600,
    color: sortCol === col ? 'var(--color-primary)' : 'var(--text-muted)',
    background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap', cursor: col ? 'pointer' : 'default',
    position: 'sticky', top: 0, zIndex: 2,
    userSelect: 'none',
  })
  const TD = { padding: '10px 10px', fontSize: 12, color: 'var(--text)',
               borderBottom: '1px solid var(--hover-bg)', verticalAlign: 'top' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Toolbar: count summary + export — search/date/filters are in the right filter panel */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 12, flexShrink: 0 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {loading ? t('audit.loading') : t('audit.countSummary', { shown: filteredAll.length, total: logs.length })}
        </p>
        <button onClick={exportCsv} disabled={filteredAll.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', fontSize: 12,
                   fontWeight: 500, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)',
                   color: 'var(--text)', cursor: filteredAll.length ? 'pointer' : 'not-allowed',
                   opacity: filteredAll.length ? 1 : 0.5, whiteSpace: 'nowrap' }}>
          <Download size={13} /> {t('audit.export')}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--color-warning-bg)',
                      // eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for this warning-banner border/text shade; kept literal to avoid changing the rendered tone
                      border: '1px solid #FDE68A', fontSize: 13, color: '#92400E', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Scrollable table container — sticky header works because overflow is here */}
      {!loading && !error && (
        <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
            <thead>
              <tr>
                <th style={{ ...TH('created_at'), width: 90 }} onClick={() => handleSort('created_at')}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    {t('audit.colDate')}<SortIcon col="created_at" sortCol={sortCol} sortDir={sortDir} />
                  </span>
                </th>
                <th style={{ ...TH(null), width: 60 }}>
                  {t('audit.colTime')}
                </th>
                <th style={{ ...TH('causer_name'), width: 120 }} onClick={() => handleSort('causer_name')}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    {t('audit.colWho')}<SortIcon col="causer_name" sortCol={sortCol} sortDir={sortDir} />
                  </span>
                </th>
                <th style={{ ...TH('log_name'), width: 120 }} onClick={() => handleSort('log_name')}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    {t('audit.colType')}<SortIcon col="log_name" sortCol={sortCol} sortDir={sortDir} />
                  </span>
                </th>
                <th style={{ ...TH(null), width: 150 }}>{t('audit.colEntity')}</th>
                <th style={{ ...TH('description'), width: 280 }} onClick={() => handleSort('description')}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    {t('audit.colAction')}<SortIcon col="description" sortCol={sortCol} sortDir={sortDir} />
                  </span>
                </th>
                <th style={TH(null)}>{t('audit.colOldValue')}</th>
                <th style={TH(null)}>{t('audit.colNewValue')}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...TD, textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>
                    {t('audit.noEntries')}
                  </td>
                </tr>
              ) : pageRows.map((entry, i) => {
                const { beforeCell, afterCell } = buildDiffCells(entry, t)
                // Access (read) rows render muted with a leading eye icon — visually
                // distinct from a write event at a glance, without hiding the row.
                const access = isAccessEvent(entry)
                return (
                  <tr key={entry.id ?? i} style={{ cursor: 'pointer', opacity: access ? 0.72 : 1 }}
                    onClick={() => setDrill(entry)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...TD, whiteSpace: 'nowrap', fontSize: 11, fontWeight: 500 }}>
                      {new Date(entry.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td style={{ ...TD, whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(entry.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={TD}>
                      <div style={{ fontWeight: 500, color: 'var(--text)' }}>{entry.causer_name ?? t('audit.system')}</div>
                    </td>
                    <td style={TD}><LogBadge logName={entry.log_name} /></td>
                    <td style={TD}>
                      {entry.subject_type ? (
                        <>
                          <div style={{ fontWeight: 500, color: 'var(--text)' }}>{entityLabel(entry.subject_type, t)}</div>
                          {entry.subject_label && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{entry.subject_label}</div>}
                        </>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ ...TD, fontWeight: 500, color: access ? 'var(--text-muted)' : 'var(--text)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {access && <Eye size={12} aria-label={t('audit.kind.access')} style={{ flexShrink: 0 }} />}
                        {entry.description}
                      </span>
                    </td>
                    <td style={{ ...TD, fontSize: 11, color: 'var(--color-danger)' }}>{beforeCell}</td>
                    <td style={{ ...TD, fontSize: 11, color: 'var(--color-success)' }}>{afterCell}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Pagination bar replaces the old load-more button. */}
      {!loading && !error && sorted.length > 0 && (
        <PaginationBar page={page} totalPages={totalPages} totalRows={sorted.length}
          pageSize={PAGE_SIZE} onPageChange={setPage}
          onPageSizeChange={null} />
      )}

      {drill && <AuditDrawer entry={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}
