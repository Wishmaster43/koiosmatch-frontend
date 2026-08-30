/**
 * TextExpandModal — the enlarge popup for a config-panel text field (Danny
 * 31-08: "de tekst is zo niet te lezen, popup of groter maken"). One big
 * textarea over an overlay; edits flow through the SAME onChange as the inline
 * field, so closing loses nothing. Focus is trapped while open (§6).
 */
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import Button from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/typography'
import { monoStyle } from '@/components/ui/typography'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export function TextExpandModal({ label, value, onChange, onClose }: {
  label: string
  value: string
  onChange: (next: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation('workflows')
  const trapRef = useFocusTrap<HTMLDivElement>(onClose)
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-overlay)', background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        style={{ position: 'fixed', zIndex: 'var(--z-overlay)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                 width: 'min(1100px, 92vw)', height: '80vh', display: 'flex', flexDirection: 'column',
                 background: 'var(--surface)', borderRadius: 12, boxShadow: 'var(--shadow-modal)', padding: 16, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <PageTitle as="span">{label}</PageTitle>
          <Button variant="ghost" iconOnly size="sm" onClick={onClose} title={t('common:close')} aria-label={t('common:close')}><X size={16} /></Button>
        </div>
        {/* The one big editing surface — same value, same onChange as the inline field. */}
        <textarea value={value} onChange={e => onChange(e.target.value)} aria-label={label} autoFocus
          style={{ flex: 1, width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 12, ...monoStyle,
                   color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                   outline: 'none', resize: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="sm" onClick={onClose}>{t('common:close')}</Button>
        </div>
      </div>
    </>
  )
}
