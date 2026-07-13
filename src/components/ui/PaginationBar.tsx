/**
 * PaginationBar — shared pagination footer for tables: "x–y of N", page size
 * selector, and first/prev/next/last controls. Calls back onPageChange /
 * onPageSizeChange so the parent can refetch. PAGE_SIZE_OPTIONS = selectable sizes.
 */
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNumberFormat } from '@/lib/formatters'

export const PAGE_SIZE_OPTIONS = [50, 100, 200, 300, 400, 500]

interface PaginationBarProps {
  page: number
  totalPages: number
  totalRows: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export default function PaginationBar({ page, totalPages, totalRows, pageSize, onPageChange, onPageSizeChange }: PaginationBarProps) {
  const { t } = useTranslation('common')
  // Locale-aware grouping (§ FMT-GETAL-1) — "1.501–2.000 van 99.968", never bare digits.
  const { formatNumber } = useNumberFormat()
  const from = totalRows === 0 ? 0 : (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, totalRows)

  const btn = (onClick: () => void, disabled: boolean, children: ReactNode, title: string) => (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)',
      color: disabled ? 'var(--border)' : 'var(--text-muted)', cursor: disabled ? 'default' : 'pointer',
      transition: 'all 0.1s',
    }}>
      {children}
    </button>
  )

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderTop: '1px solid var(--border)',
      background: 'var(--surface)', flexShrink: 0,
    }}>
      {/* Row range info */}
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {totalRows === 0 ? t('noResults') : t('rangeOf', { from: formatNumber(from), to: formatNumber(to), total: formatNumber(totalRows) })}
      </span>

      {/* Page navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {btn(() => onPageChange(1),         page <= 1,          <ChevronsLeft  size={13} />, t('firstPage'))}
        {btn(() => onPageChange(page - 1),  page <= 1,          <ChevronLeft   size={13} />, t('prevPage'))}
        <span style={{ fontSize: 12, color: 'var(--text)', padding: '0 8px', whiteSpace: 'nowrap' }}>
          {page} / {totalPages || 1}
        </span>
        {btn(() => onPageChange(page + 1),  page >= totalPages, <ChevronRight  size={13} />, t('nextPage'))}
        {btn(() => onPageChange(totalPages), page >= totalPages, <ChevronsRight size={13} />, t('lastPage'))}
      </div>

      {/* Rows per page */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('rowsPerPage')}</span>
        <select value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))}
          style={{
            fontSize: 12, padding: '3px 6px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text)', cursor: 'pointer', outline: 'none',
          }}>
          {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  )
}
