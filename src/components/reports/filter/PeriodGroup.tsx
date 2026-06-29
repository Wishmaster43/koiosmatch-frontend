/**
 * PeriodGroup — the period picker for the report filter sidebar: a
 * month/quarter/year granularity toggle, a year selector and a month/quarter
 * grid. `group.value` = '' | '2024' | '2024-Q2' | '2024-05'. Extracted from
 * ReportFilterSidebar.
 */
import { RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReportFilterGroup } from '@/types/reports'

// Locale-aware short month name for index 0–11.
const monthAbbr = (i: number) => new Date(2000, i, 1).toLocaleString(undefined, { month: 'short' })
const QUARTERS  = ['Q1','Q2','Q3','Q4']

export default function PeriodGroup({ group }: { group: ReportFilterGroup }) {
  const { t } = useTranslation('common')
  const val = group.value ?? ''

  // Derive current granularity + year from value
  const granularity = useMemo(() => {
    if (!val) return 'month'
    if (val.includes('-Q')) return 'quarter'
    if (val.includes('-'))  return 'month'
    return 'year'
  }, [val])

  const selectedYear = useMemo(() => {
    if (!val) return null
    return Number(val.split('-')[0])
  }, [val])

  const selectedSub = useMemo(() => {
    if (!val || !val.includes('-')) return null
    return val.split('-')[1] // 'Q2' or '05'
  }, [val])

  const years = group.years ?? []

  const setGranularity = (g: string) => {
    if (!selectedYear) return group.onChange?.('')
    if (g === 'year')    return group.onChange?.(String(selectedYear))
    group.onChange?.('')
  }

  const setYear = (y: number) => {
    if (granularity === 'year') return group.onChange?.(String(y))
    group.onChange?.('')
  }

  const setSub = (sub: string) => {
    if (!selectedYear) return
    group.onChange?.(`${selectedYear}-${sub}`)
  }

  const btnBase = {
    border: 'none', cursor: 'pointer', borderRadius: 5,
    fontSize: 11, fontWeight: 500, transition: 'all 0.1s',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Granularity toggle */}
      <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 7, padding: 2, gap: 2 }}>
        {[
          { id: 'month',   label: t('filters.granMonth')   },
          { id: 'quarter', label: t('filters.granQuarter') },
          { id: 'year',    label: t('filters.granYear')    },
        ].map(g => {
          const active = granularity === g.id
          return (
            <button key={g.id}
              onClick={() => setGranularity(g.id)}
              style={{ ...btnBase, flex: 1, padding: '4px 0',
                       border: active ? '1px solid var(--border)' : '1px solid transparent',
                       background: active ? 'white' : 'transparent',
                       color: active ? 'var(--text)' : 'var(--text-muted)',
                       boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>
              {g.label}
            </button>
          )
        })}
      </div>

      {/* Year selector */}
      {years.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {years.map(y => {
            const active = selectedYear === y
            return (
              <button key={y} onClick={() => setYear(y)}
                style={{ ...btnBase, padding: '3px 9px',
                         background: active ? 'var(--color-primary)' : 'var(--border)',
                         color:      active ? 'white'                : 'var(--text)',
                         fontWeight: active ? 600 : 400 }}>
                {y}
              </button>
            )
          })}
        </div>
      )}

      {/* Month grid */}
      {granularity === 'month' && selectedYear && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
          {Array.from({ length: 12 }, (_, i) => {
            const sub   = String(i + 1).padStart(2, '0')
            const active = selectedSub === sub
            return (
              <button key={sub} onClick={() => setSub(sub)}
                style={{ ...btnBase, padding: '4px 0', textAlign: 'center',
                         background: active ? 'var(--color-primary-bg)' : 'var(--hover-bg)',
                         color:      active ? 'var(--color-primary)'    : 'var(--text)',
                         border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border)'}`,
                         fontWeight: active ? 600 : 400 }}>
                {monthAbbr(i)}
              </button>
            )
          })}
        </div>
      )}

      {/* Quarter grid */}
      {granularity === 'quarter' && selectedYear && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
          {QUARTERS.map((q, i) => {
            const sub   = `Q${i + 1}`
            const active = selectedSub === sub
            return (
              <button key={sub} onClick={() => setSub(sub)}
                style={{ ...btnBase, padding: '6px 0', textAlign: 'center',
                         background: active ? 'var(--color-primary-bg)' : 'var(--hover-bg)',
                         color:      active ? 'var(--color-primary)'    : 'var(--text)',
                         border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border)'}`,
                         fontWeight: active ? 600 : 400, fontSize: 12 }}>
                {q}
              </button>
            )
          })}
        </div>
      )}

      {/* Reset period */}
      {val && (
        <button onClick={() => group.onChange?.('')}
          style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center',
                   gap: 4, padding: '4px 0', background: 'none',
                   color: 'var(--text-muted)', fontSize: 11, fontWeight: 400 }}>
          <RotateCcw size={10} /> {t('filters.clearPeriod')}
        </button>
      )}
    </div>
  )
}
