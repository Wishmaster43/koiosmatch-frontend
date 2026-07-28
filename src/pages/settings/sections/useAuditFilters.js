/**
 * useAuditFilters — owns every filter axis of the audit log: the filter state, the
 * option lists derived from the loaded rows, the filtered result, and the registration
 * of the filter groups in the shared right panel.
 *
 * Pulled out of AuditLog.jsx because it is one self-contained state+effect unit: eight
 * pieces of state that ONLY exist to narrow the row set, plus the panel effect that
 * publishes them. Neither the table nor the pagination needs to know these exist — the
 * screen just receives the rows that survived.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '@/context/RightPanelContext'
import { isAccessEvent } from './auditShared'

export function useAuditFilters(logs) {
  const { t } = useTranslation('settings')
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

  const { registerFilters, unregisterFilters } = useRightPanel()

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

  // One dependency the caller can reset its pagination on: it changes exactly when a
  // filter VALUE changes (a variable-length dependency array is not an option, and
  // depending on `filteredAll` would also fire when the row set itself reloads).
  const filterKey = useMemo(
    () => JSON.stringify([search, selectedTypes, selectedUsers, selectedRoles, selectedActor, selectedKind, dateFrom, dateTo]),
    [search, selectedTypes, selectedUsers, selectedRoles, selectedActor, selectedKind, dateFrom, dateTo],
  )

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
    // NOTE: `search` is deliberately absent from these deps — kept exactly as it was
    // before this file was extracted (see the reported finding); adding it would change
    // when the panel re-registers.
  ], [selectedTypes, selectedUsers, selectedRoles, selectedActor, selectedKind, typeOptions, userOptions, roleOptions, logs, dateFrom, dateTo, t])

  useEffect(() => {
    registerFilters('audit-log', filterGroups)
    return () => unregisterFilters('audit-log')
  }, [filterGroups, registerFilters, unregisterFilters])

  return { filteredAll, filterKey }
}
