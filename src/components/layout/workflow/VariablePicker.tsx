/**
 * VariablePicker — lets a text/textarea config field reference the output of
 * upstream modules. A "{ }" button opens a searchable list of every ancestor
 * module's fields (from its last test run); clicking one inserts a
 * `{{node.field}}` token at the cursor. The backend substitutes tokens at run
 * time. TextFieldWithVars wraps the actual input and owns the cursor insertion.
 */
import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Braces, Search, CornerDownRight } from 'lucide-react'
import { MODULE_META } from '@/modules/index'
import type { WorkflowField, WorkflowVarGroup } from '@/types/workflow'

// ── The dropdown listing upstream modules + their fields ────────────────────────

function PickerPopover({ variables, onInsert, onClose }: {
  variables: WorkflowVarGroup[]
  onInsert: (token: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation('workflows')
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()

  // Resolve a group's display name: custom node name, else translated module label.
  const groupLabel = (g: WorkflowVarGroup) =>
    g.customName || t('modules.' + g.moduleType, { defaultValue: MODULE_META[g.moduleType]?.label ?? g.moduleType })

  return (
    <>
      {/* Click-away backdrop */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 20 }} onClick={onClose} />

      <div role="dialog" aria-label={t('vars.title')}
        style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 270, maxHeight: 320,
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

        {/* Groups + fields */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
          {variables.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12, textAlign: 'center', margin: 0 }}>
              {t('vars.noUpstream')}
            </p>
          )}
          {variables.map(g => {
            const shown = g.fields.filter(f => !query || (f.label || t('vars.wholeOutput')).toLowerCase().includes(query))
            if (query && shown.length === 0) return null
            return (
              <div key={g.nodeId} style={{ marginBottom: 6 }}>
                {/* Group header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: MODULE_META[g.moduleType]?.color ?? 'var(--border)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {groupLabel(g)}
                  </span>
                  {!g.hasRun && (
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: 'auto', flexShrink: 0 }}>
                      {t('vars.notRun')}
                    </span>
                  )}
                </div>
                {/* Fields */}
                {shown.map(f => (
                  <button key={f.token} type="button" onClick={() => onInsert(f.token)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 8px 5px 18px',
                             background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 6 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <CornerDownRight size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.label || t('vars.wholeOutput')}
                    </span>
                    {f.sample ? (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {f.sample}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ── The text/textarea field with an attached variable picker ────────────────────

export function TextFieldWithVars({ field, value, onChange, variables, multiline }: {
  field: WorkflowField
  value?: unknown
  onChange: (key: string, value: unknown) => void
  variables: WorkflowVarGroup[]
  multiline?: boolean
}) {
  const { t } = useTranslation('workflows')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  // Insert a token at the caret and restore the caret just after it.
  const insert = (token: string) => {
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
    <div style={{ position: 'relative' }}>
      {multiline ? (
        <textarea ref={ref} value={(value as string) || ''} placeholder={field.placeholder || ''} aria-label={field.label}
          onChange={e => onChange(field.key, e.target.value)} rows={4}
          style={{ ...base, fontFamily: 'monospace', resize: 'vertical', paddingRight: 9 }}
          onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
          onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
      ) : (
        <input ref={ref} type="text" value={(value as string) || ''} placeholder={field.placeholder || ''} aria-label={field.label}
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
