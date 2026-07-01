import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import type { VacancyDetail } from '@/types/vacancy'

// Bytes → a short human size (KB/MB), tolerant of a missing/string size.
const humanSize = (size: unknown): string => {
  const n = Number(size)
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * DocumentsTab — read-only list of documents attached to the vacancy. Upload
 * (multipart) follows the candidate Documents pattern in a later round (B-19).
 */
export default function DocumentsTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const docs = v.documents ?? []

  if (docs.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('applicants.empty')}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {docs.map((d, i) => (
        <div key={d.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
          border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
          <FileText size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.name}
          </span>
          {humanSize(d.size) && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{humanSize(d.size)}</span>}
        </div>
      ))}
    </div>
  )
}
