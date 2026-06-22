import { useTranslation } from 'react-i18next'
import Avatar from '../../../components/ui/Avatar'
import { useDateFormat } from '../../../lib/datetime'

/**
 * NotesTab — read-only list of internal notes on the vacancy. A composer + write
 * path lands with the vacancy detail/notes endpoint (B-19 / C-26); mirrors the
 * applications NotesTab which is read-only until persistence exists.
 */
export default function NotesTab({ vacancy: v }) {
  const { t } = useTranslation('vacancies')
  const { formatDate } = useDateFormat()
  const notes = v.notes ?? []

  if (notes.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('applicants.empty')}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {notes.map(n => (
        <div key={n.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Avatar initials={(n.author?.[0] ?? '?').toUpperCase()} size={22} soft />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{n.author || '—'}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{formatDate(n.time)}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.text}</div>
        </div>
      ))}
    </div>
  )
}
