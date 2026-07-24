/**
 * SmCandidatesTable — ShiftManager candidate list, mirrors the native
 * CandidatesTable idiom (§3A): only declares columns, the generic
 * `components/ui/DataTable` handles rendering/sorting/selection/empty states.
 * Status renders as a soft chip (§4), never a solid fill; numeric/rate values
 * use JetBrains Mono.
 */
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import Avatar from '@/components/ui/Avatar'
import SoftChip from '@/components/ui/SoftChip'
import { useDateFormat } from '@/lib/datetime'
import { initialsOf } from '@/lib/initials'
import { SM_CANDIDATE_STATUS_COLORS } from './data/smCandidateStatus'
import { endDateOf } from './data/smCandidateFields'
import type { ReportCandidate, CandidateFeature, GlobalRate } from '@/types/reports'

const plainCell: CSSProperties = { color: 'var(--text)', fontSize: 12 }
const mutedCell: CSSProperties = { color: 'var(--text-muted)', fontSize: 12 }
const monoCell: CSSProperties = { color: 'var(--text)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }
const dash = <span style={{ color: 'var(--text-muted)' }}>—</span>

interface SmCandidatesTableProps {
  rows: ReportCandidate[]
  loading?: boolean
}

export default function SmCandidatesTable({ rows, loading }: SmCandidatesTableProps) {
  const { t } = useTranslation(['shiftmanager', 'reports'])
  const { formatDate } = useDateFormat()

  // Column defs — memoized so DataTable's per-row memo actually holds (mirrors
  // the native CandidatesTable's rationale: a stable `columns` reference keeps
  // a row from re-rendering when unrelated rows/state change).
  const columns: Column<ReportCandidate>[] = useMemo(() => [
    {
      key: 'name', header: t('candidates.cols.name', { ns: 'reports' }), sortable: true,
      sortValue: c => `${c.firstname ?? ''} ${c.lastname ?? ''}`.trim(), sticky: true, width: 200, nowrap: true,
      render: c => {
        const fullName = `${c.firstname ?? ''} ${c.lastname ?? ''}`.trim()
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Avatar initials={initialsOf(fullName)} size={26} soft />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--text)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fullName}>
                {fullName || '—'}
              </div>
              {c.email && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{c.email}</div>}
            </div>
          </div>
        )
      },
    },
    {
      key: 'status', header: t('candidates.cols.status', { ns: 'reports' }), sortable: true, sortValue: c => c.status ?? '',
      render: c => {
        const key = (c.status ?? '').toLowerCase()
        const color = SM_CANDIDATE_STATUS_COLORS[key] ?? 'var(--text-muted)'
        const label = c.status ? t(`candidates.status.${key}`, { ns: 'reports', defaultValue: c.status }) : t('candidates.unknown', { ns: 'reports' })
        return <SoftChip label={label} color={color} round />
      },
    },
    { key: 'position', header: t('candidates.cols.position', { ns: 'reports' }), nowrap: true, cellStyle: plainCell, sortable: true, sortValue: c => c.position ?? '', render: c => c.position || '—' },
    { key: 'mobile', header: t('candidates.cols.mobile', { ns: 'reports' }), nowrap: true, cellStyle: plainCell, sortable: true, sortValue: c => c.mobile ?? c.phone ?? '', render: c => c.mobile ?? c.phone ?? '—' },
    // Uitschrijfdatum (end_date_employment) — tolerant field read (data/smCandidateFields).
    { key: 'endEmployment', header: t('candidatesPage.cols.endEmployment'), nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => endDateOf(c) ?? '', render: c => formatDate(endDateOf(c)) },
    { key: 'registration', header: t('candidates.cols.registration', { ns: 'reports' }), nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.registration_date ?? '', render: c => formatDate(c.registration_date) },
    { key: 'lastLogin', header: t('candidates.cols.lastLogin', { ns: 'reports' }), nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.last_login_at ?? '', render: c => formatDate(c.last_login_at) },
    { key: 'plannedShift', header: t('candidates.cols.plannedShift', { ns: 'reports' }), nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.last_planned_shift ?? '', render: c => formatDate(c.last_planned_shift) },
    { key: 'lastShift', header: t('candidates.cols.lastShift', { ns: 'reports' }), nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.last_worked_shift ?? '', render: c => formatDate(c.last_worked_shift) },
    {
      key: 'shifts', header: t('candidates.cols.shifts', { ns: 'reports' }), nowrap: true, align: 'right', cellStyle: monoCell,
      sortable: true, sortValue: c => Number(c.number_of_times_worked) || 0, render: c => c.number_of_times_worked ?? 0,
    },
    {
      key: 'features', header: t('candidates.cols.features', { ns: 'reports' }), nowrap: true,
      sortValue: c => (c.features ?? []).map((f: CandidateFeature) => f.name ?? '').join(', '),
      render: c => {
        const items = (c.features ?? []).map((f: CandidateFeature) => f.name).filter((n): n is string => Boolean(n))
        if (items.length === 0) return dash
        const shown = items.slice(0, 2)
        return (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {shown.map(name => <SoftChip key={name} label={name} color="var(--color-primary)" />)}
            {items.length > shown.length && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('candidates.more', { ns: 'reports', count: items.length - shown.length })}</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'globalRates', header: t('candidates.cols.globalRates', { ns: 'reports' }), nowrap: true,
      render: c => {
        const rates = c.global_rate_summary
        if (!Array.isArray(rates) || rates.length === 0) return dash
        const shown = rates.slice(0, 2)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {shown.map((r: GlobalRate, i: number) => (
              <span key={i} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                <span style={{ color: 'var(--text-muted)' }}>{r.global_rate?.internal_description ?? r.step_name ?? '—'}: </span>
                <span style={monoCell}>{r.hour_rate != null ? `€${Number(r.hour_rate).toFixed(2)}` : '—'}</span>
              </span>
            ))}
            {rates.length > shown.length && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('candidates.more', { ns: 'reports', count: rates.length - shown.length })}</span>
            )}
          </div>
        )
      },
    },
  ], [t, formatDate])

  return (
    <DataTable
      columns={columns}
      rows={rows}
      loading={loading}
      loadingText={t('candidates.loading', { ns: 'reports' })}
      emptyText={t('candidates.empty', { ns: 'reports' })}
      stickyHeader
      defaultSort={{ key: 'name', dir: 'asc' }}
    />
  )
}
