import { useState, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Plus, X } from 'lucide-react'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

interface DocItem { id?: Id; name?: string; size?: unknown; url?: string; objectUrl?: string }

// Bytes → a short human size (KB/MB), tolerant of a missing/string size.
const humanSize = (size: unknown): string => {
  const n = Number(size)
  if (!n) return typeof size === 'string' ? size : ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * DocumentsTab — list + upload + delete for a vacancy's documents. Persists to
 * /vacancies/{id}/documents (multipart) with an optimistic row; a missing endpoint
 * fails softly (the row stays locally). Mirrors the candidate DocumentsSection, lean.
 */
export default function DocumentsTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const [docs, setDocs] = useState<DocItem[]>((v.documents ?? []) as DocItem[])
  const fileRef = useRef<HTMLInputElement>(null)

  // Upload the picked file (multipart) and show it right away (optimistic).
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const tmpId = -Date.now()
    const optimistic: DocItem = { id: tmpId, name: file.name, size: file.size, objectUrl: URL.createObjectURL(file) }
    setDocs(d => [...d, optimistic])
    const fd = new FormData()
    fd.append('file', file); fd.append('name', file.name)
    api.post(`/vacancies/${v.id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(r => { const it = r?.data?.data ?? r?.data; if (it?.id) setDocs(d => d.map(x => x.id === tmpId ? { ...optimistic, ...it } : x)) })
      .catch(() => notifyError(t('common:actionFailed')))
    e.target.value = ''
  }
  // Delete persists once the row has a real (positive numeric) id.
  const remove = (i: number) => {
    const id = docs[i]?.id
    setDocs(docs.filter((_, j) => j !== i))
    if (typeof id === 'number' && id > 0) api.delete(`/vacancies/${v.id}/documents/${id}`).catch(() => notifyError(t('common:actionFailed')))
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
            const href = d.url ?? d.objectUrl
            return (
              <div key={d.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                <FileText size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                {href
                  ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: 13, color: 'var(--color-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</a>
                  : <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>}
                {humanSize(d.size) && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{humanSize(d.size)}</span>}
                <button onClick={() => remove(i)} title={t('common:remove')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}><X size={13} /></button>
              </div>
            )
          })}
        </div>
      )}

      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={onPick} />
    </div>
  )
}
