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
 * KOIOS-GENERATE-1 (Danny 09-08): every field this popout writes today or in
 * the near future (profile text, later a customer/location description, a
 * match text) is a description-style field, never a conversation thread, so
 * it never opts into Actiepunten — it rides RichTextAssistBar's own
 * improve+summarize-only default (ACTIONS-SCOPE-DEFAULT-FLIP), no per-field
 * override needed (that mode set stays the note composer's own). `generate`
 * mirrors the drill-down's own field one-for-one — see this component's
 * `generate` prop.
 *
 * CLOSING NEVER EATS TEXT (Danny's explicit requirement) — the state row, the
 * confirmed close, the save-and-close, the beforeunload guard and Cmd+S all live
 * in the shared PopoutSaveFooter since NOTITIE-POPOUT-URL-1 gave the per-note
 * window the exact same closing contract (§11: one guard, never two copies).
 */
import RichTextEditor from '@/components/ui/RichTextEditor'
import PopoutSaveFooter from './PopoutSaveFooter'
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      {/* `fill` makes the editor the one growing item, so a resized window grows
          the WRITING space instead of empty padding (mirrors the note composer). */}
      <RichTextEditor value={value} onChange={onChange} fill minHeight={220} assistGenerate={generate} />
      <PopoutSaveFooter dirty={dirty} onSave={onSave} />
    </div>
  )
}
