/**
 * WorkflowNotFound — the honest state for a deep link that names a workflow id
 * the tenant does not have (WF-EDITOR-DEEPLINK-1): a stale `?open=<id>` link, a
 * typo'd id, or a workflow another tenant owns. Never a silent blank screen —
 * §3's four UI states apply to a deep link exactly as to any fetch.
 */
import { SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import { PageTitle, BodyText } from '@/components/ui/typography'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export default function WorkflowNotFound({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('workflows')
  // This full-screen overlay is genuinely modal (role="dialog" aria-modal), so it
  // adopts the single-source useFocusTrap for Escape + Tab-trap + initial focus,
  // instead of a hand-rolled document-level Escape listener (ESC-SWEEP-1 finding).
  const trapRef = useFocusTrap<HTMLDivElement>(onClose)
  return (
    <div ref={trapRef} role="dialog" aria-modal="true" aria-label={t('notFound.title')} tabIndex={-1}
      style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-overlay)', display: 'flex',
                  flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 14, background: 'var(--bg)' }}>
      <SearchX size={36} color="var(--border)" />
      <PageTitle>{t('notFound.title')}</PageTitle>
      <BodyText style={{ color: 'var(--text-muted)', textAlign: 'center', maxWidth: 360 }}>
        {t('notFound.message')}
      </BodyText>
      <Button variant="primary" size="sm" onClick={onClose}>{t('notFound.backToList')}</Button>
    </div>
  )
}
