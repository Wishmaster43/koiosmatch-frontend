/**
 * RichTextEditor — Tiptap-based formatted text editor (bold/italic/lists/headings/
 * align/undo + expand + HTML source toggle). Generic and reusable; toolbar tooltips
 * come via `labels` so each screen can translate them. Output is HTML (render it
 * through SafeHtml). The `<>` toggle swaps the WYSIWYG view for a raw-HTML textarea
 * so you can inspect/fix the markup.
 */
import { useEffect, useId, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { Bold, Italic, List, ListOrdered, Heading2, AlignLeft, AlignCenter, AlignRight, Undo2, Redo2, Maximize2, Minimize2, Code } from 'lucide-react'
import SelectMenu from './SelectMenu'
import RichTextAssistBar from './RichTextAssistBar'
import type { GenerateEntity, RichTextAssistMode } from './richtext/richTextAssistApi'

// Toolbar-tooltip keys (common:editor.*) — the component translates its own
// defaults (audit R2: four features each shipped a hardcoded-English copy of
// these labels; one i18n'd source here fixes every consumer). Callers may
// still override per screen via the `labels` prop.
const LABEL_KEYS = ['bold', 'italic', 'bulletList', 'orderedList', 'heading', 'alignLeft', 'alignCenter', 'alignRight', 'undo', 'redo', 'expand', 'collapse', 'html'] as const
type EditorLabels = Record<(typeof LABEL_KEYS)[number], string>

// TAAL-SPELL-1 (Danny 06-08): the language menu on EVERY editor — codes match the
// note `language` field contract (BE max:8) and the app locales.
const EDITOR_LANGS = ['nl', 'en', 'de', 'fr', 'es'] as const

interface RichTextEditorProps {
  value?: string
  onChange: (html: string) => void
  expanded?: boolean
  onToggleExpand?: () => void
  labels?: Partial<EditorLabels>
  fill?: boolean
  // MEMORY-RESIZE-1 (Danny 24-07 "txt veld niet groter maken?"): a drag-handle on
  // the content area (CSS resize) so long free text gets room without expanding.
  resizable?: boolean
  // Collapsed content height; inline row editors (experience/education desc) pass a
  // compact value so a one-line note doesn't open a huge block (Danny punt 48).
  minHeight?: number
  // TAAL-SPELL-1: spellcheck language. Controlled (language + onLanguageChange, e.g.
  // notes persist it) or uncontrolled (defaults to the app language). The picker
  // shows on every editor unless a caller opts out.
  language?: string
  onLanguageChange?: (lang: string) => void
  showLanguage?: boolean
  // Host-supplied toolbar control(s) rendered next to the language picker —
  // e.g. the note composer's dictation mic (Danny 08-08: "mic naast de taal").
  toolbarExtra?: ReactNode
  // KOIOS-ASSIST-TEXTFIELDS (Danny 08-08 "alle omschrijvingen moeten ook een mic
  // functionaliteit hebben en Koios AI"): the shared RichTextAssistBar (mic +
  // Koios assist) mounts on EVERY editor by default. Mounted HERE rather than
  // hand-passed through `toolbarExtra` at ~30 call sites on purpose — that is
  // exactly the copy-per-screen drift §11 forbids, and it would have meant
  // editing every entity page (several of them frozen drill-downs) to add the
  // same three props. Opt out with `assist={false}` when the host supplies its
  // own (the note composer does).
  assist?: boolean
  // Which assist modes the bar offers; `[]` = dictation mic only.
  assistModes?: RichTextAssistMode[]
  // KOIOS-GENERATE-1 (Danny 09-08): forwarded straight to RichTextAssistBar's own
  // `generate` prop — omit on any field the backend cannot generate for (§3).
  assistGenerate?: { entity: GenerateEntity; id: string }
}

export default function RichTextEditor({ value, onChange, expanded, onToggleExpand, labels = {}, fill = false, minHeight = 120, resizable = false, language, onLanguageChange, showLanguage = true, toolbarExtra, assist = true, assistModes, assistGenerate }: RichTextEditorProps) {
  // Merge caller overrides over the i18n'd defaults (common:editor.*).
  const { t, i18n } = useTranslation('common')
  // Effective spellcheck language: caller-controlled wins, else local choice, else app language.
  const [innerLang, setInnerLang] = useState<string | null>(null)
  const lang = language ?? innerLang ?? (i18n.language || 'nl').slice(0, 2)
  const pickLang = (l: string) => {
    setInnerLang(l)
    onLanguageChange?.(l)
  }
  const lab = useMemo(() => ({
    ...Object.fromEntries(LABEL_KEYS.map(k => [k, t(`editor.${k}`)])) as EditorLabels,
    ...labels,
  }), [t, labels])
  // Raw-HTML source mode — edit the markup directly to spot/fix errors.
  const [htmlMode, setHtmlMode] = useState(false)
  // Names the language SelectMenu trigger via aria-labelledby (a <button> is not
  // labelable via htmlFor) — an sr-only span carries the explicit "Taal"/"Language"
  // name, since the visible trigger text is the 2-letter code, not the field name.
  const langLabelId = useId()

  const editor = useEditor({
    // StarterKit already includes underline; adding it again triggers a duplicate-extension warning.
    extensions: [StarterKit, TextAlign.configure({ types: ['heading', 'paragraph'] })],
    content: value || '',
    // TAAL-SPELL-1: native browser spellcheck in the CHOSEN language — local and
    // free; never a third-party spell cloud (§9: notes hold health-adjacent text).
    editorProps: { attributes: { spellcheck: 'true', lang } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  // EXTERNAL-VALUE-SYNC (Danny 08-08 "txt komt niet in notities blok"): TipTap only
  // reads `content` at init, so an outside append — the dictation mic, the Koios
  // assist "Overnemen" — changed the value prop but never the editor. Sync any
  // external change in; a no-op while typing (value came FROM getHTML, so they
  // match) and both-empty is equivalent ('' vs TipTap's '<p></p>'), so the cursor
  // never jumps mid-keystroke. setContent's emitUpdate defaults false — no loop.
  useEffect(() => {
    if (!editor || editor.isDestroyed || htmlMode) return
    const cur = editor.getHTML()
    if (value === cur) return
    if (!value && cur === '<p></p>') return
    // emitUpdate:false (TipTap v3 options object): the change CAME from the host —
    // echoing it back through onChange would be a redundant round-trip (and a
    // loop risk on normalizing hosts).
    editor.commands.setContent(value || '', { emitUpdate: false })
  }, [value, editor, htmlMode])

  // Language switch re-applies the content attributes (TipTap has no reactive prop).
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setOptions({ editorProps: { attributes: { spellcheck: 'true', lang } } })
    }
  }, [lang, editor])

  if (!editor) return null

  // Toggle source mode; when returning to WYSIWYG, re-sync from the edited HTML.
  const toggleHtml = () => {
    if (htmlMode) editor.commands.setContent(value || '')
    setHtmlMode(m => !m)
  }

  const btn = (active: boolean): CSSProperties => ({
    padding: '4px 7px', fontSize: 12, borderRadius: 5, cursor: 'pointer',
    // Active toolbar buttons fill with the accent — the glyph follows the tenant's
    // on-accent contrast token instead of a hardcoded white (2026-08-08).
    background: active ? 'var(--color-primary)' : 'none', color: active ? 'var(--color-on-accent)' : 'var(--text-muted)',
    border: 'none', display: 'flex', alignItems: 'center',
  })

  return (
    // `fill` makes the editor grow to fill a flex parent (e.g. a stretched card column).
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)',
      ...(fill ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : null) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {/* Formatting controls — hidden in HTML source mode (they act on the WYSIWYG editor) */}
        {!htmlMode && (
          <>
            <button style={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()} title={lab.bold}><Bold size={13} /></button>
            <button style={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()} title={lab.italic}><Italic size={13} /></button>
            <button style={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()} title={lab.bulletList}><List size={13} /></button>
            <button style={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()} title={lab.orderedList}><ListOrdered size={13} /></button>
            <button style={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title={lab.heading}><Heading2 size={13} /></button>
            <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />
            <button style={btn(editor.isActive({ textAlign: 'left' }))} onClick={() => editor.chain().focus().setTextAlign('left').run()} title={lab.alignLeft}><AlignLeft size={13} /></button>
            <button style={btn(editor.isActive({ textAlign: 'center' }))} onClick={() => editor.chain().focus().setTextAlign('center').run()} title={lab.alignCenter}><AlignCenter size={13} /></button>
            <button style={btn(editor.isActive({ textAlign: 'right' }))} onClick={() => editor.chain().focus().setTextAlign('right').run()} title={lab.alignRight}><AlignRight size={13} /></button>
            <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />
            <button style={btn(false)} onClick={() => editor.chain().focus().undo().run()} title={lab.undo}><Undo2 size={13} /></button>
            <button style={btn(false)} onClick={() => editor.chain().focus().redo().run()} title={lab.redo}><Redo2 size={13} /></button>
          </>
        )}
        <div style={{ flex: 1 }} />
        {/* Dictation mic + Koios assist on EVERY free-text field — one shared
            component, driven by this editor's own value/onChange and language. */}
        {assist && (
          <RichTextAssistBar value={value || ''} onChange={onChange} language={lang} modes={assistModes} generate={assistGenerate} />
        )}
        {/* Host toolbar control(s) — e.g. the notes dictation mic, next to the language picker. */}
        {toolbarExtra}
        {/* TAAL-SPELL-1: compact spellcheck-language picker (uppercase codes) — the
            shared searchable SelectMenu (CLAUDE.md §4), never a bare native <select>.
            `display: contents` keeps the sr-only label out of the toolbar's flex
            flow so the trigger's own footprint/gap is unchanged. */}
        {showLanguage && (
          <span style={{ display: 'contents' }} title={t('editor.language', { defaultValue: 'Taal' })}>
            <span id={langLabelId} className="sr-only">{t('editor.language', { defaultValue: 'Taal' })}</span>
            <SelectMenu aria-labelledby={langLabelId} value={lang} onChange={pickLang}
              options={EDITOR_LANGS.map(l => ({ value: l, label: l.toUpperCase() }))}
              menuWidth={70}
              style={{ fontSize: 11, padding: '2px 4px', width: 'auto', background: 'var(--surface)', color: 'var(--text-muted)' }} />
          </span>
        )}
        {/* HTML source toggle */}
        <button style={btn(htmlMode)} onClick={toggleHtml} title={lab.html ?? 'HTML'}><Code size={13} /></button>
        {onToggleExpand && (
          <button style={{ ...btn(false), marginLeft: 4 }} onClick={onToggleExpand} title={expanded ? lab.collapse : lab.expand}>
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        )}
      </div>
      {htmlMode ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} spellCheck={false}
          style={{ width: '100%', boxSizing: 'border-box', minHeight: expanded ? 320 : minHeight, padding: '10px 12px',
            fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text)', background: 'var(--surface)',
            border: 'none', outline: 'none', resize: 'vertical', ...(fill ? { flex: 1 } : null) }} />
      ) : resizable ? (
        // Drag-to-grow: CSS resize needs an overflow container — the editor itself
        // then fills whatever height the user drags this wrapper to.
        <div style={{ resize: 'vertical', overflow: 'auto', minHeight: expanded ? 320 : minHeight }}>
          <EditorContent editor={editor}
            style={{ minHeight: '100%', padding: '10px 12px', fontSize: 13, color: 'var(--text)', cursor: 'text' }} />
        </div>
      ) : (
        <EditorContent editor={editor} className={fill ? 'km-editor-fill' : undefined}
          style={{ minHeight: expanded ? 320 : minHeight, padding: '10px 12px', fontSize: 13, color: 'var(--text)', cursor: 'text',
            ...(fill ? { flex: 1 } : null) }} />
      )}
    </div>
  )
}
