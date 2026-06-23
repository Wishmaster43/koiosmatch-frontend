/**
 * Workflow module field renderers — the form controls shown in the config panel,
 * one per schema `field.type`. `FieldInput` is the dispatcher; the rest are the
 * special controls it delegates to (agent/faq/webhook pickers, the inline filter
 * builder, the response-structure builder). Extracted from WorkflowCanvasEditor.
 */
import { useState, useEffect } from 'react'
import { Loader2, Plus, X, Check, Copy } from 'lucide-react'
import { OPERATORS } from './constants'

// ── Agent select field ────────────────────────────────────────────────────────

function AgentSelectField({ value, onChange, fieldKey }) {
  const [agents,  setAgents]  = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    import('@/lib/api').then(m => m.default.get('/ai/agents'))
      .then(r => setAgents(r.data?.data ?? r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  return (
    <select value={value || ''} onChange={e => onChange(fieldKey, e.target.value)}
      style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8,
               background: 'var(--surface)', fontSize: 13, color: 'var(--text)', outline: 'none', cursor: 'pointer' }}>
      <option value="">{loading ? 'Agents ophalen…' : 'Selecteer een agent…'}</option>
      {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  )
}

// ── FAQ multi-select field ─────────────────────────────────────────────────────

function FaqSelectField({ value, onChange, fieldKey }) {
  const [faqs,    setFaqs]    = useState([])
  const [loading, setLoading] = useState(true)
  const selected = Array.isArray(value) ? value : []

  useEffect(() => {
    import('@/lib/api').then(m => m.default.get('/ai/faqs'))
      .then(r => setFaqs(r.data?.data ?? r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter(v => v !== id) : [...selected, id]
    onChange(fieldKey, next)
  }

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>FAQ's ophalen…</div>
  if (faqs.length === 0) return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
      Geen FAQ's gevonden
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
      {faqs.map(faq => {
        const active = selected.includes(faq.id)
        return (
          <label key={faq.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={active} onChange={() => toggle(faq.id)}
              style={{ accentColor: 'var(--color-primary)', width: 14, height: 14, cursor: 'pointer' }} />
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{faq.name ?? faq.title ?? `FAQ ${faq.id}`}</span>
          </label>
        )
      })}
    </div>
  )
}

// ── Webhook select field ────────────────────────────────────────────────────────
// Lets a Webhook Trigger pick — or inline-create — an inbound webhook from the same
// /webhooks resource as Settings, then shows the receiving URL to hand to externals
// (Facebook, Intus, …). One webhook binds to one workflow (Make-style).
const WEBHOOK_API_URL = import.meta.env.VITE_API_URL ?? 'http://koiosmatch-api.test/api'
const WEBHOOK_BASE    = `${WEBHOOK_API_URL}/webhook`

function WebhookSelectField({ value, onChange, fieldKey }) {
  const [hooks,    setHooks]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)
  const [creating, setCreating] = useState(false)
  const [showNew,  setShowNew]  = useState(false)
  const [newName,  setNewName]  = useState('')
  const [copied,   setCopied]   = useState(false)

  // Load the tenant's inbound webhooks (same resource as Settings).
  useEffect(() => {
    import('@/lib/api').then(m => m.default.get('/webhooks'))
      .then(r => setHooks(r.data?.data ?? r.data ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const selected = hooks.find(h => String(h.id) === String(value))

  // Create a new inbound webhook inline and select it immediately.
  const create = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      const api = (await import('@/lib/api')).default
      const r   = await api.post('/webhooks', { name })
      const wh  = r.data?.data ?? r.data
      setHooks(prev => [...prev, wh])
      onChange(fieldKey, wh.id)
      setNewName(''); setShowNew(false)
    } catch { setError(true) }
    setCreating(false)
  }

  // Copy the receiving URL — the address external systems POST to.
  const copy = () => {
    if (!selected?.token) return
    navigator.clipboard.writeText(`${WEBHOOK_BASE}/${selected.token}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>Webhooks ophalen…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {error && <div style={{ fontSize: 11, color: 'var(--color-danger)' }}>Webhooks konden niet worden geladen.</div>}

      {/* Picker — existing inbound webhooks */}
      <select value={value || ''} onChange={e => onChange(fieldKey, e.target.value)}
        style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: 13, color: 'var(--text)', outline: 'none', cursor: 'pointer' }}>
        <option value="">{hooks.length ? 'Selecteer een webhook…' : 'Nog geen webhooks'}</option>
        {hooks.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
      </select>

      {/* Inline create — mirrors Make's "Create a webhook" */}
      {showNew ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Naam (bv. Facebook Leads)" onKeyDown={e => e.key === 'Enter' && create()}
            style={{ flex: 1, padding: '6px 9px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, outline: 'none' }} />
          <button type="button" onClick={create} disabled={!newName.trim() || creating}
            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 8, cursor: newName.trim() ? 'pointer' : 'not-allowed', opacity: newName.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
            {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Aanmaken
          </button>
          <button type="button" onClick={() => { setShowNew(false); setNewName('') }}
            style={{ padding: '6px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={12} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowNew(true)}
          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-primary)', background: 'none', border: '1px dashed var(--color-primary)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer' }}>
          <Plus size={11} /> Webhook aanmaken
        </button>
      )}

      {/* Receiving URL — what you give to the external system */}
      {selected?.token && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ontvangst-URL</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <code style={{ flex: 1, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', color: 'var(--text)', wordBreak: 'break-all' }}>
              {WEBHOOK_BASE}/{selected.token}
            </code>
            <button type="button" onClick={copy} title="URL kopiëren"
              style={{ padding: '6px 8px', background: copied ? 'var(--color-success-bg)' : 'var(--hover-bg)', color: copied ? 'var(--color-success)' : 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', display: 'flex' }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Geef dit adres aan het externe systeem (Facebook, Intus…) om data te ontvangen.</div>
        </div>
      )}
    </div>
  )
}

// ── Filters field ───────────────────────────────────────────────────────────────
// Inline conditions builder (field / operator / value + AND-OR), used inside an
// entity module so fetch + filter live in one module. Reuses the edge OPERATORS;
// `field.fields` supplies the selectable field list. The standalone Filter/Router
// between modules stays untouched (for multi-status branching).
function FiltersField({ field, value, onChange }) {
  const logic = value?.logic ?? 'AND'
  const conds = Array.isArray(value?.conditions) ? value.conditions : []
  const opts  = field.fields ?? []

  const set      = next        => onChange(field.key, next)
  const setLogic = l           => set({ logic: l, conditions: conds })
  const add      = ()          => set({ logic, conditions: [...conds, { field: '', operator: '=', value: '' }] })
  const del      = i           => set({ logic, conditions: conds.filter((_, j) => j !== i) })
  const upd      = (i, k, v)   => set({ logic, conditions: conds.map((c, j) => j === i ? { ...c, [k]: v } : c) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* AND / OR */}
      {conds.length > 1 && (
        <div style={{ display: 'flex', gap: 6 }}>
          {[['AND', 'ALLE'], ['OR', 'MINSTENS ÉÉN']].map(([l, lbl]) => (
            <button key={l} type="button" onClick={() => setLogic(l)}
              style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 999, border: 'none', cursor: 'pointer',
                background: logic === l ? 'var(--color-primary)' : 'var(--border)', color: logic === l ? 'white' : 'var(--text-muted)' }}>{lbl}</button>
          ))}
        </div>
      )}
      {/* Condition rows */}
      {conds.map((c, i) => {
        const needsValue = !['is leeg', 'is gevuld'].includes(c.operator)
        return (
          <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <select value={c.field} onChange={e => upd(i, 'field', e.target.value)}
              style={{ flex: 1, minWidth: 0, padding: '5px 6px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none', background: 'var(--surface)', cursor: 'pointer' }}>
              <option value="">veld…</option>
              {opts.map(o => { const v = typeof o === 'object' ? o.value : o; const l = typeof o === 'object' ? o.label : o; return <option key={v} value={v}>{l}</option> })}
            </select>
            <select value={c.operator} onChange={e => upd(i, 'operator', e.target.value)}
              style={{ padding: '5px 4px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none', background: 'var(--surface)', cursor: 'pointer' }}>
              {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
            {needsValue && (
              <input value={c.value ?? ''} onChange={e => upd(i, 'value', e.target.value)} placeholder="waarde"
                style={{ flex: 1, minWidth: 0, padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
            )}
            <button type="button" onClick={() => del(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', padding: 2, display: 'flex' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}><X size={13} /></button>
          </div>
        )
      })}
      <button type="button" onClick={add}
        style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-primary)', background: 'none', border: '1px dashed var(--color-primary)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer' }}>
        <Plus size={10} /> Conditie toevoegen
      </button>
    </div>
  )
}

// ── Response structure builder ─────────────────────────────────────────────────

const RS_TYPES = ['Text', 'Number', 'Boolean', 'Date', 'Array', 'Collection', 'Any']

function ResponseStructureField({ value, onChange, fieldKey }) {
  const items = Array.isArray(value) ? value : []

  const add    = ()        => onChange(fieldKey, [...items, { name: '', type: 'Text' }])
  const remove = (i)       => onChange(fieldKey, items.filter((_, j) => j !== i))
  const update = (i, k, v) => onChange(fieldKey, items.map((item, j) => j === i ? { ...item, [k]: v } : item))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 22px', gap: 4, padding: '0 2px', marginBottom: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Item naam</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Type</div>
          <div />
        </div>
      )}
      {items.map((item, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 22px', gap: 4, alignItems: 'center' }}>
          <input value={item.name} onChange={e => update(i, 'name', e.target.value)}
            placeholder="item_naam"
            style={{ padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none', minWidth: 0 }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
          <select value={item.type} onChange={e => update(i, 'type', e.target.value)}
            style={{ padding: '5px 5px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none', background: 'var(--surface)', cursor: 'pointer' }}>
            {RS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button type="button" onClick={() => remove(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}>
            <X size={13} />
          </button>
        </div>
      ))}
      <button type="button" onClick={add}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-primary)',
          background: 'none', border: '1px dashed var(--color-primary)', borderRadius: 6,
          padding: '5px 9px', cursor: 'pointer', marginTop: 2 }}>
        <Plus size={10} /> Item toevoegen
      </button>
    </div>
  )
}

// ── Field renderer ────────────────────────────────────────────────────────────

export function FieldInput({ field, value, onChange }) {
  if (field.type === 'agent_select') {
    return <AgentSelectField value={value} onChange={onChange} fieldKey={field.key} />
  }
  if (field.type === 'webhook_select') {
    return <WebhookSelectField value={value} onChange={onChange} fieldKey={field.key} />
  }
  if (field.type === 'filters') {
    return <FiltersField field={field} value={value} onChange={onChange} />
  }
  if (field.type === 'faq_select') {
    return <FaqSelectField value={value} onChange={onChange} fieldKey={field.key} />
  }
  if (field.type === 'response_structure') {
    return <ResponseStructureField value={value} onChange={onChange} fieldKey={field.key} />
  }
  if (field.type === 'boolean') {
    return (
      <button type="button" onClick={() => onChange(field.key, !value)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        <div style={{ position: 'relative', width: 32, height: 17, borderRadius: 999, background: value ? 'var(--color-primary)' : 'var(--border)', flexShrink: 0, transition: 'background 0.2s' }}>
          <div style={{ position: 'absolute', top: 2, left: value ? 17 : 2, width: 13, height: 13, borderRadius: '50%', background: 'var(--surface)', transition: 'left 0.2s' }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{value ? 'Aan' : 'Uit'}</span>
      </button>
    )
  }
  if (field.type === 'multiselect') {
    const selected = Array.isArray(value) ? value : []
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {field.options.map(opt => {
          const active = selected.includes(opt)
          return (
            <button key={opt} type="button"
              onClick={() => onChange(field.key, active ? selected.filter(v => v !== opt) : [...selected, opt])}
              style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 12,
                background: active ? 'var(--color-primary-bg)' : 'var(--hover-bg)',
                color:      active ? 'var(--color-primary)'    : 'var(--text-muted)',
                border:     `1px solid ${active ? '#C4C0F0' : 'var(--border)'}`,
                cursor: 'pointer',
              }}>
              {opt}
            </button>
          )
        })}
      </div>
    )
  }
  if (field.type === 'select') {
    return (
      <select value={value ?? field.default ?? ''} onChange={e => onChange(field.key, e.target.value)}
        style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: 13, color: 'var(--text)', outline: 'none' }}>
        {field.default == null && <option value="">Selecteer...</option>}
        {(field.options ?? []).map(o => {
          const val = typeof o === 'object' ? o.value : o
          const lbl = typeof o === 'object' ? o.label : o
          return <option key={val} value={val}>{lbl}</option>
        })}
      </select>
    )
  }
  if (field.type === 'textarea') {
    return (
      <textarea value={value || ''} placeholder={field.placeholder || ''}
        onChange={e => onChange(field.key, e.target.value)}
        rows={4}
        style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical' }}
        onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
        onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
    )
  }
  if (field.type === 'keyvalue') {
    const pairs = Array.isArray(value) ? value : []
    const update = (i, k, v) => onChange(field.key, pairs.map((p, j) => j === i ? { ...p, [k]: v } : p))
    const add    = () => onChange(field.key, [...pairs, { name: '', value: '' }])
    const remove = (i) => onChange(field.key, pairs.filter((_, j) => j !== i))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {pairs.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 4 }}>
            <input value={p.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Naam"
              style={{ flex: 1, padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
            <input value={p.value} onChange={e => update(i, 'value', e.target.value)} placeholder="Waarde"
              style={{ flex: 1, padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
            <button type="button" onClick={() => remove(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '0 4px' }}>
              <X size={12} />
            </button>
          </div>
        ))}
        <button type="button" onClick={add}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-primary)', background: 'none', border: '1px dashed var(--color-primary)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
          <Plus size={10} /> Toevoegen
        </button>
      </div>
    )
  }
  return (
    <input type={field.type === 'number' ? 'number' : 'text'}
      value={value || ''}
      placeholder={field.placeholder || ''}
      onChange={e => onChange(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
      style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }}
      onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
      onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
  )
}
