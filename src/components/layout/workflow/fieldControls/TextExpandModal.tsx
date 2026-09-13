/**
 * TextExpandModal — the enlarge popup for a config-panel text field (Danny
 * 31-08: "de tekst is zo niet te lezen, popup of groter maken"). One big
 * textarea over an overlay; edits flow through the SAME onChange as the inline
 * field, so closing loses nothing. Focus is trapped while open (§6).
 */
import { useTranslation } from 'react-i18next'
import ModalFooter from '@/components/ui/ModalFooter'
import { monoStyle } from '@/components/ui/typography'
import FloatingPanel from '@/components/ui/FloatingPanel'

export function TextExpandModal({ label, value, onChange, onClose }: {
  label: string
  value: string
  onChange: (next: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation('workflows')
  return (
    // POPUP-AUDIT-1: migrated onto the shared FloatingPanel. closeOnBackdrop is off
    // because the textarea holds live unsaved edits (§4 "ernaast klikken en alles weg").
    <FloatingPanel open onClose={onClose} ariaLabel={label} title={label}
      width="min(1100px, 92vw)" persistKey="workflow-text-expand" resizable
      closeOnBackdrop={false} scrollBody={false}
      bodyStyle={{ padding: 16, gap: 10 }}>
      {/* The one big editing surface — same value, same onChange as the inline field.
          The height floor sits on the textarea as its flex basis (74vh, the old 80vh
          minus chrome), never on the body: a floored body cannot shrink, so a user
          resize below it would clip the footer (Opus review, 13-09). */}
      <textarea value={value} onChange={e => onChange(e.target.value)} aria-label={label} autoFocus
        style={{ flex: '1 1 74vh', minHeight: 0, width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 12, ...monoStyle,
                 color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                 outline: 'none', resize: 'none' }} />
      <ModalFooter onCancel={onClose} cancelLabel={t('common:close')} />
    </FloatingPanel>
  )
}
