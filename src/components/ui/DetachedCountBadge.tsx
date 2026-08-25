/**
 * DetachedCountBadge — the ONE place every drill-down (candidate/vacancy/customer)
 * shows its currently-detached-applications count. A warning signal, not a KPI:
 * hidden entirely at zero so an unaffected record shows nothing extra.
 */
import { useTranslation } from 'react-i18next'
import { Unlink } from 'lucide-react'
import { tint } from '@/lib/tint'

interface DetachedCountBadgeProps {
  // Server-computed, whole-history count of applications CURRENTLY detached
  // (soft-deleted, not restored) linked to this record. Hidden at 0/undefined —
  // this is a warning signal, not a KPI (ONTKOPPEL-TELLER-1, SOLLICITATIES §22).
  count?: number
}

/**
 * DetachedCountBadge — the ONE place every drill-down (candidate/vacancy/customer)
 * shows its currently-detached-applications count: a soft danger-tinted chip next to
 * ReferenceNumberChip in the title row. Only renders above zero; never implies the
 * screen's active filter window (the count is the record's whole history).
 */
export default function DetachedCountBadge({ count }: DetachedCountBadgeProps) {
  const { t } = useTranslation('common')
  if (!count || count <= 0) return null

  return (
    <span title={t('detachedCount.tooltip', { count })}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
        padding: '2px 9px', borderRadius: 999, background: 'var(--color-danger-bg)',
        // Ink is --color-on-danger-bg — the raw danger colour reads only 3.95:1 on its
        // own pastel, AA fail (Opus r3.5). Border stays the plain danger tint.
        color: 'var(--color-on-danger-bg)', border: `1px solid ${tint('var(--color-danger)', 40)}` }}>
      <Unlink size={11} />
      {t('detachedCount.label', { count })}
    </span>
  )
}
