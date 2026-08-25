/**
 * DictationTextarea — the ONE plain-text multi-line field WITH the house mic
 * (walkthrough 21-08, POP-UPS 4: "alle omschrijvingen in pop-ups een mic",
 * i.e. "every description field in a popup gets a mic"). For reason/description
 * fields whose storage is PLAIN text: a full RichTextEditor would silently switch
 * them to HTML, so this keeps the <textarea> and attaches the shared assist bar
 * in mic-only plain-text mode (modes=[] + plainText — dictation appends raw
 * text, Koios-assist stays off because its output is HTML). Field face comes
 * from fieldMetrics' canon.
 */
import type { CSSProperties } from 'react'
import RichTextAssistBar from '@/components/ui/RichTextAssistBar'
import { fieldTextareaStyle } from '@/components/forms/fieldMetrics'

interface DictationTextareaProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  autoFocus?: boolean
  id?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  // Layout only (height/margin); identity comes from the canon.
  style?: CSSProperties
}

export default function DictationTextarea({ value, onChange, placeholder, rows = 3, autoFocus, style, ...aria }: DictationTextareaProps) {
  return (
    <div>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        rows={rows} autoFocus={autoFocus} {...aria}
        style={{ ...fieldTextareaStyle, ...style }} />
      {/* Mic-only, plain-text: the dictated chunk lands as raw text in the field. */}
      <div style={{ marginTop: 6 }}>
        <RichTextAssistBar value={value} onChange={onChange} modes={[]} plainText />
      </div>
    </div>
  )
}
