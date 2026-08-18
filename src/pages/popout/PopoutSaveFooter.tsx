/**
 * PopoutSaveFooter — the ONE closing contract of every second-screen editor
 * window (profile text, per-note editor): the honest saved/unsaved state, a
 * "close" that confirms before discarding, a "save and close" that only closes
 * on a LANDED write, a beforeunload guard while dirty, and Cmd/Ctrl+S as a
 * plain checkpoint. Lifted out of TextPopoutEditor when the per-note window
 * (NOTITIE-POPOUT-URL-1) needed the exact same behaviour — two copies of a
 * close-guard is how one of them silently eats text (§11).
 *
 * CLOSING NEVER EATS TEXT (Danny's explicit requirement): the beforeunload
 * guard arms only while dirty; the close button confirms through the house
 * dialog (never window.confirm — untranslatable, unstylable); saveAndClose
 * closes only when onSave resolves true.
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfirm } from '@/hooks/useConfirm'
import { Save, X } from 'lucide-react'
import Button from '@/components/ui/Button'

interface PopoutSaveFooterProps {
  // Unsaved-changes marker — drives the state text AND every guard here.
  dirty: boolean
  // Resolves TRUE only when the write actually landed.
  onSave: () => Promise<boolean>
}

export default function PopoutSaveFooter({ dirty, onSave }: PopoutSaveFooterProps) {
  const { t } = useTranslation('common')
  const { confirm, dialog: confirmDialog } = useConfirm()

  // Warn before this window is closed/reloaded with unsaved text. The browser
  // shows its own generic wording — returnValue only arms it.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // Save AND close (Danny 09-08): this window exists to write ONE thing, so
  // finishing it is finishing the window — but only on a landed write.
  const saveAndClose = async () => { if (await onSave()) window.close() }

  // Close WITHOUT saving (Danny 10-08): unsaved text is confirmed before it goes —
  // this window may hold the only copy, and a silent discard is the one thing a
  // second screen must never do.
  const close = () => {
    if (!dirty) { window.close(); return }
    confirm(t('discardChangesConfirm'), () => window.close(), { danger: true, confirmLabel: t('close') })
  }

  // Cmd/Ctrl+S saves without reaching for the mouse (§6). Read off a ref so the
  // listener binds ONCE, not per keystroke (the parent re-renders per character).
  const saveRef = useRef(onSave)
  useEffect(() => { saveRef.current = onSave })
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.key === 's' && (e.metaKey || e.ctrlKey))) return
      e.preventDefault()
      saveRef.current()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0 }}>
      {confirmDialog}
      {/* Honest, announced save state — never a silent "did that land?" window. */}
      <span aria-live="polite" data-testid="text-popout-state"
        style={{ fontSize: 11, color: dirty ? 'var(--color-warning)' : 'var(--text-muted)' }}>
        {dirty ? t('unsavedChanges') : t('allChangesSaved')}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={close} data-testid="text-popout-close"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 500,
            borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer',
            background: 'var(--surface)', color: 'var(--text-muted)' }}>
          <X size={13} /> {t('close')}
        </button>
        <Button variant="primary" size="sm" onClick={saveAndClose} disabled={!dirty} data-testid="text-popout-save">
          <Save size={13} /> {t('popout.saveAndClose')}
        </Button>
      </div>
    </div>
  )
}
