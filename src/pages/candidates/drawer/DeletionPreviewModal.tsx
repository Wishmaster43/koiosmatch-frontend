/**
 * DeletionPreviewModal — the confirm popup before a PERMANENT candidate delete
 * (ERASE-1). Fetches GET /candidates/{id}/deletion-preview and lists exactly what
 * will be erased (applications/matches/appointments/notes/documents/tasks/…), so
 * the recruiter sees the blast radius before the irreversible force-delete. The
 * counts match precisely what the backend removes (§8 AVG right-to-erasure).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import type { Id } from '@/types/common'

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 70 }
const panel: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 71, width: 420, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 12, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }

interface PreviewCounts { applications?: number; matches?: number; appointments?: number; notes?: number; documents?: number; tasks?: number; timeline_events?: number; conversations?: number }

export default function DeletionPreviewModal({ candidateId, candidateName, onClose, onConfirm }: {
  candidateId: Id
  candidateName: string
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation(['candidates', 'common'])
  const [counts, setCounts] = useState<PreviewCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  // Load the blast-radius counts once.
  useEffect(() => {
    let alive = true
    api.get(`/candidates/${candidateId}/deletion-preview`, { quiet404: true })
      .then(r => { if (alive) setCounts((r.data?.data?.counts ?? r.data?.counts ?? {}) as PreviewCounts) })
      .catch(() => { if (alive) setCounts({}) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [candidateId])

  // Only the non-zero rows, in a stable order, with a translated label.
  const rows = (['applications', 'matches', 'appointments', 'notes', 'documents', 'tasks', 'timeline_events', 'conversations'] as const)
    .map(k => ({ k, n: counts?.[k] ?? 0 }))
    .filter(r => r.n > 0)

  const confirm = () => { setDeleting(true); onConfirm() }

  return (
    <>
      <div style={overlay} onClick={onClose} />
      <div style={panel} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}><AlertTriangle size={16} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{t('erase.confirmTitle')}</span>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 12, lineHeight: 1.5 }}>
          {t('erase.confirmBody', { name: candidateName })}
        </p>

        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>{t('common:loading')}</div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0 12px' }}>{t('erase.nothingLinked')}</div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
            {rows.map((r, i) => (
              <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', fontSize: 12.5,
                borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', color: 'var(--text)' }}>
                <span>{t(`erase.item.${r.k}`)}</span>
                <span style={{ fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{r.n}</span>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: 11.5, color: 'var(--color-danger)', marginBottom: 16 }}>{t('erase.irreversible')}</p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common:cancel')}</button>
          <button onClick={confirm} disabled={deleting}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: 'var(--color-danger)', color: '#fff', cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>
            {deleting ? t('common:saving') : t('erase.confirmButton')}
          </button>
        </div>
      </div>
    </>
  )
}
