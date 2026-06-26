/**
 * RichTextEditor — Tiptap-based formatted text editor (bold/italic/lists/headings/
 * align/undo + expand + HTML source toggle). Generic and reusable; toolbar tooltips
 * come via `labels` so each screen can translate them. Output is HTML (render it
 * through SafeHtml). The `<>` toggle swaps the WYSIWYG view for a raw-HTML textarea
 * so you can inspect/fix the markup.
 */
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Bold, Italic, List, ListOrdered, Heading2, AlignLeft, AlignCenter, AlignRight, Undo2, Redo2, Maximize2, Minimize2, Code } from 'lucide-react'

// Built-in toolbar tooltips so callers don't have to pass labels; override per screen.
const DEFAULT_LABELS = {
  bold: 'Bold', italic: 'Italic', bulletList: 'Bullet list', orderedList: 'Numbered list',
  heading: 'Heading', alignLeft: 'Align left', alignCenter: 'Align center', alignRight: 'Align right',
  undo: 'Undo', redo: 'Redo', expand: 'Expand', collapse: 'Collapse', html: 'HTML source',
}

interface RichTextEditorProps {
  value?: string
  onChange: (html: string) => void
  expanded?: boolean
  onToggleExpand?: () => void
  labels?: Partial<typeof DEFAULT_LABELS>
  fill?: boolean
}

export default function RichTextEditor({ value, onChange, expanded, onToggleExpand, labels = {}, fill = false }: RichTextEditorProps) {
  // Merge caller overrides over the built-in English defaults.
  const lab = { ...DEFAULT_LABELS, ...labels }
  // Raw-HTML source mode — edit the markup directly to spot/fix errors.
  const [htmlMode, setHtmlMode] = useState(false)

  const editor = useEditor({
    extensions: [StarterKit, Underline, TextAlign.configure({ types: ['heading', 'paragraph'] })],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && !editor.isDestroyed && value === '') editor.commands.clearContent()
  }, [value, editor])

  if (!editor) return null

  // Toggle source mode; when returning to WYSIWYG, re-sync from the edited HTML.
  const toggleHtml = () => {
    if (htmlMode) editor.commands.setContent(value || '')
    setHtmlMode(m => !m)
  }

  const btn = (active: boolean): CSSProperties => ({
    padding: '4px 7px', fontSize: 12, borderRadius: 5, cursor: 'pointer',
    background: active ? 'var(--color-primary)' : 'none', color: active ? 'white' : 'var(--text-muted)',
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
          style={{ width: '100%', boxSizing: 'border-box', minHeight: expanded ? 320 : 120, padding: '10px 12px',
            fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text)', background: 'var(--surface)',
            border: 'none', outline: 'none', resize: 'vertical', ...(fill ? { flex: 1 } : null) }} />
      ) : (
        <EditorContent editor={editor} className={fill ? 'km-editor-fill' : undefined}
          style={{ minHeight: expanded ? 320 : 120, padding: '10px 12px', fontSize: 13, color: 'var(--text)', cursor: 'text',
            ...(fill ? { flex: 1 } : null) }} />
      )}
    </div>
  )
}
