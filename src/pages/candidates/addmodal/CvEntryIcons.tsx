/**
 * CvEntryIcons — header affordances for starting a candidate from a CV (Danny
 * 13-08: "Kandidaat uit geplakte tekst onzin en gewoon niet mooi"). Two compact
 * icon buttons replace the old two full banner cards: an upload icon (opens the
 * existing file picker) and a paste icon (opens a small popover with the
 * existing paste-and-read flow). Parsing itself is unchanged — useCvParse /
 * usePasteCvPrefill / cvPrefill still drive both paths; this component only
 * decides how the recruiter STARTS them. Mirrors the drill-down's 26x26
 * bordered icon idiom (ProfileTab's own pop-out affordance).
 */
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUp, ClipboardPaste } from 'lucide-react'
import { CV_ACCEPT_MIME, CV_TEXT_MIN_CHARS, CV_TEXT_MAX_CHARS } from './useCvParse'

interface CvEntryIconsProps {
  onFile: (file: File) => void
  onSubmitText: (text: string) => void
}

// Tenant-tinted icon buttons (Danny 14-08 "icons in kleur van tenant zoals de
// knoppen"): the §4 soft-tint recipe the shared buttons wear — primary tint,
// primary border, AA primary text — slightly larger than the muted 26px idiom.
const iconBtn: CSSProperties = {
  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 8, cursor: 'pointer',
  background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
  border: '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)',
  color: 'var(--color-primary-text)',
}

export default function CvEntryIcons({ onFile, onSubmitText }: CvEntryIconsProps) {
  const { t } = useTranslation(['candidates', 'common'])
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [text, setText] = useState('')
  const tooShort = text.trim().length > 0 && text.trim().length < CV_TEXT_MIN_CHARS
  const canSubmit = text.trim().length >= CV_TEXT_MIN_CHARS && text.trim().length <= CV_TEXT_MAX_CHARS

  // Close on an outside click or Escape — a plain non-modal popover.
  useEffect(() => {
    if (!pasteOpen) return
    const onDown = (e: MouseEvent) => { if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPasteOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPasteOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [pasteOpen])

  // Hand the chosen file up, then clear the input so picking the SAME file again
  // still fires a change event (browsers suppress an identical value).
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFile(file)
  }

  // Submit the pasted text and close — progress/result then show in the status
  // card that appears in the form grid below (PasteCvCard, busy/ready/error only).
  const submit = () => {
    onSubmitText(text)
    setText('')
    setPasteOpen(false)
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
      <button type="button" onClick={() => inputRef.current?.click()}
        title={t('modal.cv.uploadButton')} aria-label={t('modal.cv.uploadButton')} style={iconBtn}>
        <FileUp size={14} />
      </button>
      {/* The real input: labelled for assistive tech, kept out of the tab order and
          out of sight — the visible button is what drives it (§6). */}
      <input ref={inputRef} type="file" accept={CV_ACCEPT_MIME} onChange={handleChange}
        aria-label={t('modal.cv.choose')} tabIndex={-1}
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, border: 0, padding: 0 }} />

      <button type="button" onClick={() => setPasteOpen(o => !o)} aria-expanded={pasteOpen}
        title={t('modal.cvPaste.openButton')} aria-label={t('modal.cvPaste.openButton')}
        style={{ ...iconBtn,
          // Open = the stronger active tint (§4: active is a stronger tint + weight).
          background: pasteOpen ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)' : iconBtn.background,
          borderColor: pasteOpen ? 'color-mix(in srgb, var(--color-primary) 50%, transparent)' : undefined }}>
        <ClipboardPaste size={14} />
      </button>

      {pasteOpen && (
        <div ref={popoverRef}
          style={{ position: 'absolute', top: 32, right: 0, zIndex: 20, width: 320, padding: 10, borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
            display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea value={text} onChange={e => setText(e.target.value)}
            aria-label={t('modal.cvPaste.title')} placeholder={t('modal.cvPaste.placeholder')}
            maxLength={CV_TEXT_MAX_CHARS}
            style={{ minHeight: 90, resize: 'vertical', fontSize: 12, color: 'var(--text)',
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" disabled={!canSubmit} onClick={submit}
              style={{ height: 26, padding: '0 12px', fontSize: 12, borderRadius: 8,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                border: '1px solid color-mix(in srgb, var(--color-primary) 45%, transparent)',
                background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', color: 'var(--color-primary-text)',
                fontWeight: 600, opacity: canSubmit ? 1 : 0.5 }}>
              {t('modal.cvPaste.submit')}
            </button>
            {tooShort && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('modal.cvPaste.tooShort', { min: CV_TEXT_MIN_CHARS })}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
