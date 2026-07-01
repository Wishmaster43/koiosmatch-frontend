import { useState, useMemo, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Building2, Layers } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
import { Avatar, StatusBadge, ac } from './locationParts'
import LocationDrawer from './LocationDrawer'
import type { SmLocationRow } from '@/types/shiftmanager'

// Raw location from /sm_locations.
interface RawLocation {
  id?: string | number
  name?: string
  customer?: string | { name?: string }
  city?: string
  address?: string
  status?: string
  departments?: Array<string | { name?: string }>
  shift_count?: number
  [k: string]: unknown
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LocationsPage() {
  const { t } = useTranslation('shiftmanager')
  const [locations, setLocations] = useState<SmLocationRow[]>([])
  const [search]                  = useState('')
  const [selected,  setSelected]  = useState<SmLocationRow | null>(null)
  const [page,      setPage]      = useState(1)
  const [selStatuses,  setSelStatuses]  = useState<string[]>([])
  const [selCustomers,   setSelCustomers]   = useState<string[]>([])
  const [selCities,    setSelCities]    = useState<string[]>([])
  const pageSize = 10

  const { registerFilters, unregisterFilters } = useRightPanel()

  // Load locations directly from /sm_locations. A failed/empty call shows an
  // empty list, never fabricated rows.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/sm_locations', { signal: ctrl.signal })
      .then(res => {
        const { rows } = unwrapList<RawLocation>(res)
        setLocations(rows.map(l => ({
          id:          l.id,
          name:        l.name ?? '',
          customer:    (typeof l.customer === 'object' ? l.customer?.name : l.customer) ?? '',
          city:        l.city ?? '',
          address:     l.address ?? '',
          status:      l.status === 'active' ? 'Actief' : l.status === 'inactive' ? 'Inactief' : (l.status ?? 'Actief'),
          departments: (l.departments ?? []).map(d => (typeof d === 'object' ? d?.name : d) ?? ''),
          shifts:      l.shift_count ?? 0,
        })))
      })
      .catch(err => { if (!isAbortError(err)) setLocations([]) })
    return () => ctrl.abort()
  }, [])

  const toggle = (setter: Dispatch<SetStateAction<string[]>>) => (val: string) =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const statusOptions = useMemo(() => [...new Set(locations.map(l => l.status).filter((x): x is string => Boolean(x)))].sort(), [locations])
  const customerOptions  = useMemo(() => [...new Set(locations.map(l => l.customer).filter((x): x is string => Boolean(x)))].sort(), [locations])
  const cityOptions  = useMemo(() => [...new Set(locations.map(l => l.city).filter((x): x is string => Boolean(x)))].sort(), [locations])

  const filterGroups = useMemo(() => [
    { key: 'status',  label: t('locationsPage.filter.status'),
      options: statusOptions.map(s => ({ value: s, label: s })),
      selected: selStatuses,  onToggle: toggle(setSelStatuses) },
    { key: 'klant',   label: t('locationsPage.filter.customer'),
      options: customerOptions.map(k => ({ value: k, label: k })),
      selected: selCustomers,   onToggle: toggle(setSelCustomers) },
    { key: 'stad',    label: t('locationsPage.filter.city'),
      options: cityOptions.map(s => ({ value: s, label: s })),
      selected: selCities,    onToggle: toggle(setSelCities) },
  ], [t, statusOptions, customerOptions, cityOptions, selStatuses, selCustomers, selCities])

  useEffect(() => {
    registerFilters('locations-page', filterGroups)
    return () => unregisterFilters('locations-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  const filtered = useMemo(() => {
    let rows = locations
    if (selStatuses.length) rows = rows.filter(l => selStatuses.includes(l.status as string))
    if (selCustomers.length)  rows = rows.filter(l => selCustomers.includes(l.customer as string))
    if (selCities.length)   rows = rows.filter(l => selCities.includes(l.city as string))
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(l =>
        (l.name ?? '').toLowerCase().includes(q) ||
        (l.customer ?? '').toLowerCase().includes(q) ||
        (l.city ?? '').toLowerCase().includes(q)
      )
    }
    return rows
  }, [locations, search, selStatuses, selCustomers, selCities])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  // KPI cards — translated labels; values are derived from the live list.
  const kpis = [
    { label: t('locationsPage.kpi.total'),           value: locations.length,                                    color: 'var(--color-primary)',   bg: 'var(--color-primary-bg)',   Icon: MapPin },
    { label: t('locationsPage.kpi.active'),          value: locations.filter(l => l.status === 'Actief').length, color: 'var(--color-success)',   bg: 'var(--color-success-bg)',   Icon: Building2 },
    { label: t('locationsPage.kpi.departments'),     value: locations.reduce((s,l) => s + (l.departments ?? []).length, 0), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)',   Icon: Layers },
    { label: t('locationsPage.kpi.linkedCustomers'), value: [...new Set(locations.map(l => l.customer))].length,  color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', Icon: Building2 },
  ]

  const headers = [
    t('locationsPage.cols.location'), t('locationsPage.cols.customer'), t('locationsPage.cols.city'),
    t('locationsPage.cols.departments'), t('locationsPage.cols.shifts'), t('locationsPage.cols.status'),
  ]

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* KPI strip */}
        <div style={{ padding: '20px 24px 18px', display: 'flex', gap: 20, flexShrink: 0 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: k.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <k.Icon size={15} color={k.color} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {headers.map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11,
                      fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em',
                      textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((loc, i) => {
                  const isSel = selected?.id === loc.id
                  const deps = loc.departments ?? []
                  return (
                    <tr key={loc.id} onClick={() => setSelected(isSel ? null : loc)}
                      style={{ borderBottom: i < paged.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer', transition: 'background 0.1s',
                        background: isSel ? 'var(--color-primary-bg)' : 'transparent' }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--hover-bg)' }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>

                      {/* Locatie */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar label={loc.name} size={30} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{loc.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{loc.address}</div>
                          </div>
                        </div>
                      </td>

                      {/* Klant */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 5, background: ac(loc.customer),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 800, color: 'var(--surface)', flexShrink: 0 }}>
                            {loc.customer?.charAt(0)}
                          </div>
                          <span style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>{loc.customer}</span>
                        </div>
                      </td>

                      {/* Stad */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <MapPin size={12} color="var(--text-muted)" />
                          <span style={{ fontSize: 13, color: 'var(--text)' }}>{loc.city}</span>
                        </div>
                      </td>

                      {/* Afdelingen */}
                      <td style={{ padding: '12px 14px' }}>
                        {deps.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{deps.length}</span>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {deps.slice(0, 2).map(d => (
                                <span key={d} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999,
                                  background: 'var(--hover-bg)', border: '1px solid var(--border)',
                                  color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d}</span>
                              ))}
                              {deps.length > 2 && (
                                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999,
                                  background: 'var(--hover-bg)', border: '1px solid var(--border)',
                                  color: 'var(--text-muted)' }}>+{deps.length - 2}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Diensten */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 13, color: (loc.shifts ?? 0) > 0 ? 'var(--text)' : 'var(--text-muted)',
                          fontWeight: (loc.shifts ?? 0) > 0 ? 600 : 400 }}>{loc.shifts}</span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={loc.status} />
                      </td>
                    </tr>
                  )
                })}
                {paged.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center',
                    color: 'var(--text-muted)', fontSize: 13 }}>{t('locationsPage.empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>{t('locationsPage.count', { count: filtered.length })}</span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
                    background: 'none', cursor: page > 1 ? 'pointer' : 'default',
                    color: page > 1 ? 'var(--text)' : 'var(--text-muted)', fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
                    background: 'none', cursor: page < totalPages ? 'pointer' : 'default',
                    color: page < totalPages ? 'var(--text)' : 'var(--text-muted)', fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <LocationDrawer loc={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
