/**
 * useInstructionList — the CRUD + reorder machinery behind ai_agent's
 * `instructions` field (INTERVIEW-WORKFLOW-1, Appendix A/B). Rows are stored as
 * a stable-id array (`{ id, text, output_field?, required? }`); every mutation
 * writes the whole array back through the shared FieldInput `onChange` contract
 * (never a patch), mirroring OrderedListField's own move/add/remove idiom.
 */
import type { OnChange } from './types'

// One AI-instruction row: `text` is the RichTextEditor HTML, `output_field`
// optionally names the bundle key the agent should write its extracted answer
// into, `required` marks a question the agent must not skip.
export interface InstructionRow {
  id: string
  text: string
  output_field?: string
  required?: boolean
}

// Stable id generator — a real UUID (mirrors serialization.ts's `uid`), so a
// duplicated/added row never collides with an existing one across reorders.
const newId = () => (crypto.randomUUID?.() ?? `instr-${Date.now()}-${Math.random().toString(36).slice(2)}`)

// Owns the instruction-list array behind one config-panel field: read the
// stored rows tolerantly, and expose add/remove/duplicate/move/update/insertVar
// as whole-array writes through the field's own onChange.
export function useInstructionList(value: unknown, onChange: OnChange, fieldKey: string) {
  const rows = (Array.isArray(value) ? value : []) as InstructionRow[]
  const write = (next: InstructionRow[]) => onChange(fieldKey, next)

  // Patch one row by id, leaving every other row untouched.
  const update = (id: string, patch: Partial<InstructionRow>) =>
    write(rows.map(r => (r.id === id ? { ...r, ...patch } : r)))

  // Append a fresh, empty row at the bottom (next free position, §3B ordering rule).
  const add = () => write([...rows, { id: newId(), text: '', required: false }])

  const remove = (id: string) => write(rows.filter(r => r.id !== id))

  // Insert a copy directly after the source row, with its own new id.
  const duplicate = (id: string) => {
    const idx = rows.findIndex(r => r.id === id)
    if (idx === -1) return
    const copy: InstructionRow = { ...rows[idx], id: newId() }
    write([...rows.slice(0, idx + 1), copy, ...rows.slice(idx + 1)])
  }

  // Swap one row with its neighbour in the given direction; no-op at either end.
  const move = (id: string, dir: -1 | 1) => {
    const i = rows.findIndex(r => r.id === id)
    const j = i + dir
    if (i === -1 || j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[i], next[j]] = [next[j], next[i]]
    write(next)
  }

  // Append a variable token at the end of a row's text (VariablePicker's caret
  // insertion assumes a plain input/textarea ref, which RichTextEditor's Tiptap
  // instance is not — this stays a minimal, honest "append", never a second
  // token vocabulary: the token itself still comes from the shared WorkflowVarField).
  const insertVar = (id: string, token: string) => {
    const row = rows.find(r => r.id === id)
    if (!row) return
    const sep = row.text ? ' ' : ''
    update(id, { text: row.text + sep + token })
  }

  return { rows, add, remove, duplicate, move, update, insertVar }
}
