import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Plus, X } from 'lucide-react'
import type { VacancyDetail } from '@/types/vacancy'
import { useEntityDocuments } from '@/hooks/useEntityDocuments'

/**
 * DocumentsTab — list + upload + delete for a vacancy's documents. Data + persistence
 * live in useEntityDocuments (G-4): the list loads from /vacancies/{id}/documents and
 * upload/delete are optimistic. The link opens the signed download_url (or the local
 * blob for a not-yet-uploaded row). Mirrors the customer DocumentsTab, lean.
 */
export default function DocumentsTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const { docs, upload, remove } = useEntityDocuments('vacancies', v.id)
  const fileRef = useRef<HTMLInputElement>(null)

  // Upload the picked file (multipart); an optimistic row appears immediately.
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    upload(file, '', file.name, URL.createObjectURL(file))
    e.target.value = ''
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('drawer.tabs.documents')}</span>
        <button onClick={() => fileRef.current?.click()}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
          <Plus size={11} /> {t('common:add')}
        </button>
      </div>

      {docs.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('applicants.empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {docs.map((d, i) => {
            const href = d.download_url ?? d.objectUrl
            return (
              <div key={String(d.id ?? i)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                <FileText size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                {href
                  ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: 13, color: 'var(--color-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</a>
                  : <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>}
                {d.size && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.size}</span>}
                <button onClick={() => remove(d.id)} title={t('common:remove')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}><X size={13} /></button>
              </div>
            )
          })}
        </div>
      )}

      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={onPick} />
    </div>
  )
}
