/**
 * VariablePicker — lets a text/textarea config field reference the output of
 * upstream modules (Make-style). A "{ }" button opens a searchable panel listing
 * every ancestor module's output FIELDS (from the workflow's last run or a module
 * test run) as clickable chips, grouped per module; nested paths (user.mobile)
 * expand under their parent chip. Clicking a chip inserts the field at the cursor:
 * a flat `{{field}}` placeholder by default (the BE resolves those against the
 * bundle), or the bare dot-path for filter fields (`insertMode="path"`).
 * TextFieldWithVars wraps the actual input and owns the cursor insertion.
 */
import { useMemo, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Braces, Search, ChevronRight } from 'lucide-react'
import { MODULE_META } from '@/modules/index'
import { fieldLabel, fieldPlaceholder } from './moduleI18n'
import type { WorkflowField, WorkflowVarField, WorkflowVarGroup } from '@/types/workflow'

export type InsertMode = 'token' | 'path'

// ── One clickable field chip ─────────────────────────────────────────────────────

function FieldChip({ field, display, onInsert }: {
  field: WorkflowVarField; display: string; onInsert: (f: WorkflowVarField) => void
}) {
  return (
    <button type="button" onClick={() => onInsert(field)}
      title={field.sample ? `${field.label} — ${field.sample}` : field.label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%', padding: '2px 8px',
               borderRadius: 999, border: '1px solid var(--border)', background: 'var(--hover-bg)',
               cursor: 'pointer', lineHeight: '16px' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-primary-bg)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--hover-bg)' }}>
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</span>
      {field.sample ? (
        <span style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{field.sample}</span>
      ) : null}
    </button>
  )
}

// ── One upstream module group: header + its field chips (nested paths expandable) ─

function ModuleGroup({ group, query, onInsert }: {
  group: WorkflowVarGroup; query: string; onInsert: (f: WorkflowVarField) => void
}) {
  const { t } = useTranslation('workflows')
  const [openParents, setOpenParents] = useState<Set<string>>(new Set())

  // Group fields by their first path segment: depth-0 chips + expandable parents.
  const tree = useMemo(() => {
    const top: Array<{ key: string; field?: WorkflowVarField; children: WorkflowVarField[] }> = []
    const byKey = new Map<string, { key: string; field?: WorkflowVarField; children: WorkflowVarField[] }>()
    for (const f of group.fields) {
      const head = (f.label || '').split('.')[0]
      let entry = byKey.get(head)
      if (!entry) { entry = { key: head, children: [] }; byKey.set(head, entry); top.push(entry) }
      if (f.label === head) entry.field = f
      else entry.children.push(f)
    }
    return top
  }, [group.fields])

  // Resolve the group's display name: custom node name, else translated module label.
  const label = group.customName
    || t('modules.' + group.moduleType, { defaultValue: MODULE_META[group.moduleType]?.label ?? group.moduleType })

  // Search filter: an entry stays when its own path or any child path matches.
  const q = query
  const shown = tree.filter(e => !q || e.key.toLowerCase().includes(q) || e.children.some(c => c.label.toLowerCase().includes(q)))
  if (q && shown.length === 0) return null

  const toggle = (key: string) => setOpenParents(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Group header — module colour dot + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px' }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: MODULE_META[group.moduleType]?.color ?? 'var(--border)', flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {!group.hasRun && (
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: 'auto', flexShrink: 0 }}>{t('vars.notRun')}</span>
        )}
      </div>

      {/* No output yet → explain how to get fields instead of a dead token */}
      {group.fields.length === 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, padding: '0 8px 4px 18px' }}>{t('vars.notRunHint')}</p>
      )}

      {/* Field chips (flat) + expandable parents for nested paths */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 8px 2px 18px' }}>
        {shown.map(entry => {
          const hasChildren = entry.children.length > 0
          const isOpen = !!q || openParents.has(entry.key)
          return (
            <span key={entry.key} style={{ display: 'contents' }}>
              {entry.field && <FieldChip field={entry.field} display={entry.key} onInsert={onInsert} />}
              {hasChildren && (
                <button type="button" onClick={() => toggle(entry.key)} aria-expanded={isOpen}
                  aria-label={entry.key}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999,
                           border: '1px dashed var(--border)', background: 'none', cursor: 'pointer', lineHeight: '16px' }}>
                  <ChevronRight size={10} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s' }} />
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{entry.key}.</span>
                </button>
              )}
              {hasChildren && isOpen && (
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, width: '100%', paddingLeft: 14 }}>
                  {entry.children
                    .filter(c => !q || c.label.toLowerCase().includes(q))
                    .map(c => <FieldChip key={c.token} field={c} display={c.label.slice(entry.key.length + 1)} onInsert={onInsert} />)}
                </span>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── The dropdown listing upstream modules + their fields ────────────────────────

function PickerPopover({ variables, onInsert, onClose }: {
  variables: WorkflowVarGroup[]
  onInsert: (f: WorkflowVarField) => void
  onClose: () => void
}) {
  const { t } = useTranslation('workflows')
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()

  return (
    <>
      {/* Click-away backdrop */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 20 }} onClick={onClose} />

      <div role="dialog" aria-label={t('vars.title')}
        style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, minWidth: 340, maxWidth: '90vw', maxHeight: 340,
                 display: 'flex', flexDirection: 'column', background: 'var(--surface)', zIndex: 21,
                 border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', overflow: 'hidden' }}>

        {/* Search */}
        <div style={{ position: 'relative', padding: 8, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <Search size={12} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder={t('vars.search')} aria-label={t('vars.search')}
            style={{ width: '100%', padding: '5px 8px 5px 26px', fontSize: 12, border: '1px solid var(--border)',
                     borderRadius: 6, outline: 'none', background: 'var(--surface)', color: 'var(--text)' }} />
        </div>

        {/* Groups + field chips */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
          {variables.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12, textAlign: 'center', margin: 0 }}>
              {t('vars.noUpstream')}
            </p>
          )}
          {variables.map(g => <ModuleGroup key={g.nodeId} group={g} query={query} onInsert={onInsert} />)}
        </div>
      </div>
    </>
  )
}

// ── The text/textarea field with an attached variable picker ────────────────────

export function TextFieldWithVars({ field, value, onChange, variables, multiline, insertMode = 'token' }: {
  field: WorkflowField
  value?: unknown
  onChange: (key: string, value: unknown) => void
  variables: WorkflowVarGroup[]
  multiline?: boolean
  insertMode?: InsertMode
}) {
  const { t } = useTranslation('workflows')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  // Insert the chosen field at the caret and restore the caret just after it.
  // 'token' = flat {{field}} placeholder; 'path' = bare dot-path (filter fields).
  const insert = (f: WorkflowVarField) => {
    const token = insertMode === 'path' ? f.label : f.token
    const el = ref.current
    const cur = (value as string) || ''
    const start = el?.selectionStart ?? cur.length
    const end   = el?.selectionEnd ?? cur.length
    const next  = cur.slice(0, start) + token + cur.slice(end)
    onChange(field.key, next)
    const pos = start + token.length
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(pos, pos) } })
    setOpen(false)
  }

  const base = { width: '100%', padding: multiline ? '7px 9px' : '7px 30px 7px 9px', border: '1px solid var(--border)',
    borderRadius: 8, fontSize: multiline ? 12 : 13, color: 'var(--text)', background: 'var(--surface)',
    outline: 'none', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      {multiline ? (
        <textarea ref={ref} value={(value as string) || ''} placeholder={fieldPlaceholder(t, field.placeholder)} aria-label={fieldLabel(t, field.label)}
          onChange={e => onChange(field.key, e.target.value)} rows={4}
          style={{ ...base, fontFamily: 'monospace', resize: 'vertical', paddingRight: 9 }}
          onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
          onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
      ) : (
        <input ref={ref} type="text" value={(value as string) || ''} placeholder={fieldPlaceholder(t, field.placeholder)} aria-label={fieldLabel(t, field.label)}
          onChange={e => onChange(field.key, e.target.value)}
          style={base}
          onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
          onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
      )}

      {/* Picker toggle — top-right of the field */}
      <button type="button" onClick={() => setOpen(o => !o)} aria-label={t('vars.title')} title={t('vars.title')}
        style={{ position: 'absolute', top: multiline ? 6 : '50%', right: 6, transform: multiline ? 'none' : 'translateY(-50%)',
                 width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                 background: open ? 'var(--color-primary-bg)' : 'var(--hover-bg)', border: '1px solid var(--border)',
                 borderRadius: 5, cursor: 'pointer', color: open ? 'var(--color-primary)' : 'var(--text-muted)' }}>
        <Braces size={12} />
      </button>

      {open && <PickerPopover variables={variables} onInsert={insert} onClose={() => setOpen(false)} />}
    </div>
  )
}
