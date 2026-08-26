/**
 * DeletionPreviewModal — the confirm popup before a PERMANENT candidate delete
 * (ERASE-1). Fetches GET /candidates/{id}/deletion-preview and lists exactly what
 * will be erased (applications/matches/appointments/notes/documents/tasks/…), so
 * the recruiter sees the blast radius before the irreversible force-delete. The
 * counts match precisely what the backend removes (§8 AVG right-to-erasure).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { BodyText } from '@/components/ui/typography'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'

interface PreviewCounts { applications?: number; matches?: number; appointments?: number; notes?: number; documents?: number; tasks?: number; timeline_events?: number; conversations?: number }

// Permanent-delete confirm popup (see the module doc above): fetches the blast-radius preview so the recruiter sees exactly what will be erased before force-delete.
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
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel — draggable header,
    // SE-resize, remembered position; the danger-icon title moves into the drag handle.
    <FloatingPanel open onClose={onClose} ariaLabel={t('erase.confirmTitle')}
      persistKey="deletion-preview" width={420} maxWidth="92vw" bodyStyle={{ padding: 22 }}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', background: 'var(--color-danger-bg)', color: 'var(--color-on-danger-bg)' }}><AlertTriangle size={16} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('erase.confirmTitle')}</span>
        </div>
      }>

        <BodyText style={{ marginBottom: 12 }}>
          {t('erase.confirmBody', { name: candidateName })}
        </BodyText>

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

        <p style={{ fontSize: 11.5, color: 'var(--color-danger-text)', marginBottom: 16 }}>{t('erase.irreversible')}</p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>{t('common:cancel')}</Button>
          <Button variant="danger" onClick={confirm} disabled={deleting}>
            {deleting ? t('common:saving') : t('erase.confirmButton')}
          </Button>
        </div>
    </FloatingPanel>
  )
}
