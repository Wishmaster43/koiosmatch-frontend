/**
 * TextPopoutEditor — the writing surface inside a second-screen text window
 * (TEKST-POPOUT-1, Danny 08-08 punt 2). Presentational by design: the draft, the
 * sync and the persistence all live in the page's hooks (§3), this file only
 * renders the shared RichTextEditor full-height plus one save footer.
 *
 * It is the SAME RichTextEditor the drill-down uses, so the popped-out field
 * keeps its formatting toolbar, its spellcheck language, and — since
 * KOIOS-ASSIST-TEXTFIELDS — the shared dictation mic + Koios assist bar, without
 * a single prop of its own (`assist` defaults to true).
 *
 * KOIOS-GENERATE-1 (Danny 09-08): `assistModes` is hardcoded to Verbeteren/
 * Samenvatten (no Actiepunten) — every field this popout writes today or in the
 * near future (profile text, later a customer/location description, a match
 * text) is a description-style field, never a conversation thread, so
 * "extract action items" never fits here (that stays the note composer's own
 * mode set). `generate` mirrors the drill-down's own field one-for-one — see
 * this component's `generate` prop.
 *
 * CLOSING NEVER EATS TEXT (Danny's explicit requirement): a native beforeunload
 * guard fires while the draft is dirty, so closing or reloading this window
 * always asks first. It is written out here rather than extracted into a shared
 * hook because the only other beforeunload in the app (workflow
 * useEditorExitGuards) is entangled with that editor's history/confirm guards —
 * a "shared" hook neither side could adopt is not a shared hook (§11).
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Save } from 'lucide-react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import type { GenerateEntity } from '@/components/ui/richtext/richTextAssistApi'

interface TextPopoutEditorProps {
  value: string
  onChange: (html: string) => void
  // Resolves TRUE only when the write actually landed.
  onSave: () => Promise<boolean>
  // Unsaved-changes marker — drives the footer state AND the close guard.
  dirty: boolean
  // KOIOS-GENERATE-1: which entity/id this popped-out field belongs to — omit on
  // any field the backend cannot generate for (§3, mirrors the drill-down).
  generate?: { entity: GenerateEntity; id: string }
}

export default function TextPopoutEditor({ value, onChange, onSave, dirty, generate }: TextPopoutEditorProps) {
  const { t } = useTranslation('common')

  // Warn before this window is closed/reloaded with unsaved text. The browser
  // shows its own generic wording — returnValue only arms it.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // Save AND close (Danny 09-08: "bij opslaan van pop-out sluit het venster niet").
  // This window exists to write ONE field, so finishing it is finishing the window.
  // It closes only on a landed write — closing on a REJECTED save would take the
  // recruiter's text with it. The button says "en sluiten" so the closing is never
  // a surprise (§3); Cmd+S below stays a plain checkpoint that keeps you writing.
  const saveAndClose = async () => { if (await onSave()) window.close() }

  // Cmd/Ctrl+S saves without reaching for the mouse — the whole point of a
  // full-screen writing window (§6 keyboard operability). The handler reads the
  // save action off a ref so the listener is bound ONCE, not re-bound per
  // keystroke (the parent re-renders on every character).
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      {/* `fill` makes the editor the one growing item, so a resized window grows
          the WRITING space instead of empty padding (mirrors the note composer). */}
      <RichTextEditor value={value} onChange={onChange} fill minHeight={220}
        assistModes={['improve', 'summarize']} assistGenerate={generate} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0 }}>
        {/* Honest, announced save state — never a silent "did that land?" window. */}
        <span aria-live="polite" data-testid="text-popout-state"
          style={{ fontSize: 11, color: dirty ? 'var(--color-warning)' : 'var(--text-muted)' }}>
          {dirty ? t('unsavedChanges') : t('allChangesSaved')}
        </span>
        <button type="button" onClick={saveAndClose} disabled={!dirty} data-testid="text-popout-save"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600,
            borderRadius: 8, border: 'none', cursor: dirty ? 'pointer' : 'default', opacity: dirty ? 1 : 0.5,
            background: 'var(--color-primary)', color: 'var(--color-on-accent)' }}>
          <Save size={13} /> {t('popout.saveAndClose')}
        </button>
      </div>
    </div>
  )
}
