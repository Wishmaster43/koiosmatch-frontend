/**
 * DocumentsTab — the customer's documents. Read-only list with a calm empty state
 * for now; the upload flow follows once the documents endpoint is wired.
 */
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import type { Id } from '../../../types/common'

interface CustomerDoc { id?: Id; name?: string }

export default function DocumentsTab({ documents = [] }: { documents?: CustomerDoc[] }) {
  const { t } = useTranslation('customers')

  if (documents.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('documents.empty')}</div>
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {documents.map((d, i) => (
        <div key={d.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', fontSize: 13,
          borderBottom: i < documents.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <FileText size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, color: 'var(--text)' }}>{d.name}</span>
        </div>
      ))}
    </div>
  )
}
