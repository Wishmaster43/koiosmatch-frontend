/**
 * RichTextEditor — Tiptap-based formatted text editor (bold/italic/lists/headings/
 * align/undo + expand). Generic and reusable; toolbar tooltips come via `labels`
 * so each screen can translate them. Output is HTML (render it through SafeHtml).
 */
import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Bold, Italic, List, ListOrdered, Heading2, AlignLeft, AlignCenter, AlignRight, Undo2, Redo2, Maximize2, Minimize2 } from 'lucide-react'

export default function RichTextEditor({ value, onChange, expanded, onToggleExpand, labels = {} }) {
  const editor = useEditor({
    extensions: [StarterKit, Underline, TextAlign.configure({ types: ['heading', 'paragraph'] })],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && !editor.isDestroyed && value === '') editor.commands.clearContent()
  }, [value, editor])

  if (!editor) return null

  const btn = (active) => ({
    padding: '4px 7px', fontSize: 12, borderRadius: 5, cursor: 'pointer',
    background: active ? 'var(--color-primary)' : 'none', color: active ? 'white' : 'var(--text-muted)',
    border: 'none', display: 'flex', alignItems: 'center',
  })

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <button style={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()} title={labels.bold}><Bold size={13} /></button>
        <button style={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()} title={labels.italic}><Italic size={13} /></button>
        <button style={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()} title={labels.bulletList}><List size={13} /></button>
        <button style={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()} title={labels.orderedList}><ListOrdered size={13} /></button>
        <button style={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title={labels.heading}><Heading2 size={13} /></button>
        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />
        <button style={btn(editor.isActive({ textAlign: 'left' }))} onClick={() => editor.chain().focus().setTextAlign('left').run()} title={labels.alignLeft}><AlignLeft size={13} /></button>
        <button style={btn(editor.isActive({ textAlign: 'center' }))} onClick={() => editor.chain().focus().setTextAlign('center').run()} title={labels.alignCenter}><AlignCenter size={13} /></button>
        <button style={btn(editor.isActive({ textAlign: 'right' }))} onClick={() => editor.chain().focus().setTextAlign('right').run()} title={labels.alignRight}><AlignRight size={13} /></button>
        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />
        <button style={btn(false)} onClick={() => editor.chain().focus().undo().run()} title={labels.undo}><Undo2 size={13} /></button>
        <button style={btn(false)} onClick={() => editor.chain().focus().redo().run()} title={labels.redo}><Redo2 size={13} /></button>
        <div style={{ flex: 1 }} />
        {onToggleExpand && (
          <button style={{ ...btn(false), marginLeft: 4 }} onClick={onToggleExpand} title={expanded ? labels.collapse : labels.expand}>
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        )}
      </div>
      <EditorContent editor={editor} style={{ minHeight: expanded ? 320 : 120, padding: '10px 12px', fontSize: 13, color: 'var(--text)', cursor: 'text' }} />
    </div>
  )
}
