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
import { isAccessEvent, entityLabel } from './auditShared'

// Owns the audit log's full filter surface — state, derived option lists, the
// filtered result and the right-panel registration (see file docblock above).
export function useAuditFilters(logs) {
  const { t } = useTranslation('settings')
  const [search,        setSearch]        = useState('')
  const [selectedTypes, setSelectedTypes] = useState([])
  // Entity-type filter (CHANGELOG-OVERAL-1): filters on `subject_type` — which KIND
  // of record changed (Candidate, Vacancy, Location, …) — distinct from the existing
  // `selectedTypes`/log_name filter above (which is the log DOMAIN: auth/settings/…).
  const [selectedSubjectTypes, setSelectedSubjectTypes] = useState([])
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

  // Distinct log-domain values (auth/settings/…) seen in the loaded rows, for the type filter.
  const typeOptions  = useMemo(() => [...new Set(logs.map(l => l.log_name).filter(Boolean))].sort(), [logs])
  // Distinct entity kinds (Candidate, Vacancy, …) seen in the loaded rows, for the entity filter.
  const subjectTypeOptions = useMemo(() => [...new Set(logs.map(l => l.subject_type).filter(Boolean))].sort(), [logs])
  // Distinct causer names seen in the loaded rows, for the "who" filter.
  const userOptions  = useMemo(() => [...new Set(logs.map(l => l.causer_name).filter(Boolean))].sort(), [logs])
  // Distinct role names touched by role-domain log entries, for the role filter.
  const roleOptions  = useMemo(() => [...new Set(
    logs.filter(l => l.log_name === 'roles').map(l => l.properties?.role ?? l.properties?.name).filter(Boolean)
  )].sort(), [logs])

  // Apply all filters including date range.
  const filteredAll = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs.filter(l => {
      if (selectedTypes.length && !selectedTypes.includes(l.log_name))    return false
      if (selectedSubjectTypes.length && !selectedSubjectTypes.includes(l.subject_type)) return false
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
  }, [logs, search, selectedTypes, selectedSubjectTypes, selectedUsers, selectedRoles, selectedActor, selectedKind, dateFrom, dateTo])

  // One dependency the caller can reset its pagination on: it changes exactly when a
  // filter VALUE changes (a variable-length dependency array is not an option, and
  // depending on `filteredAll` would also fire when the row set itself reloads).
  const filterKey = useMemo(
    () => JSON.stringify([search, selectedTypes, selectedSubjectTypes, selectedUsers, selectedRoles, selectedActor, selectedKind, dateFrom, dateTo]),
    [search, selectedTypes, selectedSubjectTypes, selectedUsers, selectedRoles, selectedActor, selectedKind, dateFrom, dateTo],
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
    // CHANGELOG-OVERAL-1: entity-type filter on `subject_type` (Candidate, Vacancy,
    // Location, Setting, …) — sits next to the date-range filter, distinct from the
    // log-domain filter above.
    ...(subjectTypeOptions.length > 0 ? [{
      key: 'subjectType', label: t('audit.filterEntity'), type: 'search-select',
      selected: selectedSubjectTypes,
      options: subjectTypeOptions.map(st => ({
        value: st, label: entityLabel(st, t),
        count: logs.filter(l => l.subject_type === st).length,
      })),
      onToggle: v => setSelectedSubjectTypes(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    }] : []),
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
    // `search` MUST be a dep: this array is what gets registered in the shared
    // right panel (below), and registration only re-fires when this memo's
    // reference changes. Without `search` here, typing into the search box
    // updated internal filtering correctly (it's a `filteredAll` dep) but the
    // registered group's `value` stayed the STALE one from the last time some
    // OTHER filter changed — and since ReportFilterSidebar's search box is a
    // fully controlled input bound to that stale `value`, the box didn't just
    // show old text, it silently rejected every keystroke (no re-render ever
    // reached it) until another filter forced a fresh registration. `onChange`
    // itself was never stale — it is the `setSearch` state setter, which React
    // guarantees is referentially stable across renders.
  ], [search, selectedTypes, selectedSubjectTypes, selectedUsers, selectedRoles, selectedActor, selectedKind, typeOptions, subjectTypeOptions, userOptions, roleOptions, logs, dateFrom, dateTo, t])

  // Registers this screen's filter groups with the shared right panel, and
  // unregisters them on cleanup so a stale group doesn't outlive this screen.
  useEffect(() => {
    registerFilters('audit-log', filterGroups)
    return () => unregisterFilters('audit-log')
  }, [filterGroups, registerFilters, unregisterFilters])

  return { filteredAll, filterKey }
}
