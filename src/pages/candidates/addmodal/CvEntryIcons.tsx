/**
 * CvEntryIcons — header affordances for starting a candidate from a CV (Danny
 * 13-08: "Kandidaat uit geplakte tekst onzin en gewoon niet mooi"). Two compact
 * icon buttons replace the old two full banner cards: an upload icon (opens the
 * existing file picker) and a paste icon (opens a small popover with the
 * existing paste-and-read flow). Parsing itself is unchanged — useCvParse /
 * useCvPrefill / cvPrefill still drive both paths (useCvPrefill is called once
 * per path, each getting its own independent parse instance); this component
 * only decides how the recruiter STARTS them. Mirrors the drill-down's 26x26
 * bordered icon idiom (ProfileTab's own pop-out affordance).
 */
import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUp, ClipboardPaste } from 'lucide-react'
import { CV_ACCEPT_ATTR, CV_TEXT_MIN_CHARS, CV_TEXT_MAX_CHARS } from './useCvParse'
import { useEscapeLayer } from '@/hooks/useEscapeLayer'
import { useClickOutside } from '@/hooks/useClickOutside'
import Button from '@/components/ui/Button'
import { tintBg, tintBorder } from '@/lib/tint'

interface CvEntryIconsProps {
  onFile: (file: File) => void
  onSubmitText: (text: string) => void
}

// Tenant-tinted icon buttons (Danny 14-08 "icons in kleur van tenant zoals de
// knoppen"): the §4 soft-tint recipe (lib/tint's house 10/33-16/50 pair, never
// an ad-hoc color-mix percentage), slightly larger than the muted 26px idiom.
const iconBtnStyle = (active = false) => ({
  width: 30, height: 30, padding: 0, borderRadius: 8,
  background: tintBg('var(--color-primary)', active),
  border: tintBorder('var(--color-primary)', active),
  color: 'var(--color-primary-text)',
})

// Two compact icon buttons for starting a candidate from a CV: upload (file
// picker) and paste (a small popover feeding the same parse flow).
export default function CvEntryIcons({ onFile, onSubmitText }: CvEntryIconsProps) {
  const { t } = useTranslation(['candidates', 'common'])
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [text, setText] = useState('')
  const tooShort = text.trim().length > 0 && text.trim().length < CV_TEXT_MIN_CHARS
  const canSubmit = text.trim().length >= CV_TEXT_MIN_CHARS && text.trim().length <= CV_TEXT_MAX_CHARS

  // Close on an outside click — a plain non-modal popover (shared useClickOutside, CLICK-OUTSIDE-2).
  useClickOutside([popoverRef], pasteOpen, () => setPasteOpen(false))

  // Escape layer: closes the paste popover (one-stage).
  useEscapeLayer(pasteOpen, () => setPasteOpen(false))

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
      <Button type="button" iconOnly onClick={() => inputRef.current?.click()}
        title={t('modal.cv.uploadButton')} aria-label={t('modal.cv.uploadButton')} style={iconBtnStyle()}>
        <FileUp size={14} />
      </Button>
      {/* The real input: labelled for assistive tech, kept out of the tab order and
          out of sight — the visible button is what drives it (§6). */}
      <input ref={inputRef} type="file" accept={CV_ACCEPT_ATTR} onChange={handleChange}
        aria-label={t('modal.cv.choose')} tabIndex={-1}
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, border: 0, padding: 0 }} />

      {/* Open = the stronger active tint (§4: active is a stronger tint + weight). */}
      <Button type="button" iconOnly onClick={() => setPasteOpen(o => !o)} aria-expanded={pasteOpen} aria-pressed={pasteOpen}
        title={t('modal.cvPaste.openButton')} aria-label={t('modal.cvPaste.openButton')}
        style={iconBtnStyle(pasteOpen)}>
        <ClipboardPaste size={14} />
      </Button>

      {pasteOpen && (
        <div ref={popoverRef}
          style={{ position: 'absolute', top: 32, right: 0, zIndex: 'var(--z-popover)', width: 320, padding: 10, borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: 'var(--shadow-float)',
            display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea value={text} onChange={e => setText(e.target.value)}
            aria-label={t('modal.cvPaste.title')} placeholder={t('modal.cvPaste.placeholder')}
            maxLength={CV_TEXT_MAX_CHARS}
            style={{ minHeight: 90, resize: 'vertical', fontSize: 12, color: 'var(--text)',
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Button type="button" variant="primary" size="sm" disabled={!canSubmit} onClick={submit}>
              {t('modal.cvPaste.submit')}
            </Button>
            {tooShort && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('modal.cvPaste.tooShort', { min: CV_TEXT_MIN_CHARS })}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
