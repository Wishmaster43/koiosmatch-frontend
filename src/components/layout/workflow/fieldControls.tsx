/**
 * Workflow field controls — the "special" config-panel inputs that fetch data or
 * build nested structures: the agent/FAQ/webhook pickers, the inline filter
 * builder and the response-structure builder. The plain inputs + the dispatcher
 * live in `fields.tsx`, which delegates the field types below to these.
 */
import { useState, useEffect } from 'react'
import { Loader2, Plus, X, Check, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { VALUELESS_OPERATORS, normalizeOperator } from './constants'
import { fieldLabel } from './moduleI18n'
import { FilterFieldPicker } from './FilterFieldPicker'
import { OperatorSelect } from './OperatorSelect'
import type { WorkflowField, EdgeFilters, FilterCondition } from '@/types/workflow'

// Shared change handler: writes one field's value into the node config.
export type OnChange = (key: string, value: unknown) => void

// ── FAQ multi-select field ─────────────────────────────────────────────────────

export function FaqSelectField({ value, onChange, fieldKey }: { value?: unknown; onChange: OnChange; fieldKey: string }) {
  const { t } = useTranslation('workflows')
  const [faqs,    setFaqs]    = useState<Array<{ id?: string | number; name?: string; title?: string }>>([])
  const [loading, setLoading] = useState(true)
  const selected: unknown[] = Array.isArray(value) ? value : []

  useEffect(() => {
    import('@/lib/api').then(m => m.default.get('/ai/faqs'))
      .then(r => setFaqs(r.data?.data ?? r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: string | number) => {
    const next = selected.includes(id) ? selected.filter(v => v !== id) : [...selected, id]
    onChange(fieldKey, next)
  }

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>{t('fields.faqLoading')}</div>
  if (faqs.length === 0) return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
      {t('fields.faqEmpty')}
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
      {faqs.map(faq => {
        const active = selected.includes(faq.id)
        return (
          <label key={faq.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={active} onChange={() => toggle(faq.id as string | number)}
              style={{ accentColor: 'var(--color-primary)', width: 14, height: 14, cursor: 'pointer' }} />
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{faq.name ?? faq.title ?? t('fields.faqFallback', { id: faq.id })}</span>
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

export function WebhookSelectField({ value, onChange, fieldKey }: { value?: unknown; onChange: OnChange; fieldKey: string }) {
  const { t } = useTranslation('workflows')
  const [hooks,    setHooks]    = useState<Array<{ id?: string | number; name?: string; token?: string }>>([])
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

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>{t('fields.webhookLoading')}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {error && <div style={{ fontSize: 11, color: 'var(--color-danger)' }}>{t('fields.webhookError')}</div>}

      {/* Picker — existing inbound webhooks */}
      <select value={(value as string) || ''} onChange={e => onChange(fieldKey, e.target.value)}
        aria-label={t('fields.webhookSelect')}
        style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: 13, color: 'var(--text)', outline: 'none', cursor: 'pointer' }}>
        <option value="">{hooks.length ? t('fields.webhookSelect') : t('fields.webhookEmpty')}</option>
        {hooks.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
      </select>

      {/* Inline create — mirrors Make's "Create a webhook" */}
      {showNew ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            placeholder={t('fields.webhookNamePlaceholder')} aria-label={t('fields.webhookNamePlaceholder')} onKeyDown={e => e.key === 'Enter' && create()}
            style={{ flex: 1, padding: '6px 9px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, outline: 'none' }} />
          <button type="button" onClick={create} disabled={!newName.trim() || creating}
            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 8, cursor: newName.trim() ? 'pointer' : 'not-allowed', opacity: newName.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
            {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} {t('fields.create')}
          </button>
          <button type="button" onClick={() => { setShowNew(false); setNewName('') }}
            style={{ padding: '6px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={12} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowNew(true)}
          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-primary)', background: 'none', border: '1px dashed var(--color-primary)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer' }}>
          <Plus size={11} /> {t('fields.webhookCreate')}
        </button>
      )}

      {/* Receiving URL — what you give to the external system */}
      {selected?.token && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('fields.receivingUrl')}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <code style={{ flex: 1, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', color: 'var(--text)', wordBreak: 'break-all' }}>
              {WEBHOOK_BASE}/{selected.token}
            </code>
            <button type="button" onClick={copy} title={t('fields.copyUrl')}
              style={{ padding: '6px 8px', background: copied ? 'var(--color-success-bg)' : 'var(--hover-bg)', color: copied ? 'var(--color-success)' : 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', display: 'flex' }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('fields.webhookHint')}</div>
        </div>
      )}
    </div>
  )
}

// ── Lookup-backed select ────────────────────────────────────────────────────────
// Options come from a tenant lookup endpoint (e.g. /whatsapp-message-types) instead of
// a hardcoded list (§10: no hardcoded vocabularies in workflow nodes). Lazy api import,
// mirroring WebhookSelectField. Fail-soft to an empty list.
export function LookupSelectField({ value, onChange, fieldKey, endpoint }: {
  value?: unknown; onChange: OnChange; fieldKey: string; endpoint: string
}) {
  const { t } = useTranslation('workflows')
  const [opts, setOpts] = useState<Array<{ value: string; label: string }>>([])

  // Load the lookup values once; accept the common {value|id, label|name} shapes.
  useEffect(() => {
    if (!endpoint) return
    let alive = true
    import('@/lib/api').then(m => m.default.get(endpoint))
      .then(r => {
        const rows = (r.data?.data ?? r.data ?? []) as Array<Record<string, unknown>>
        if (alive) setOpts(rows
          .map(o => ({ value: String(o.value ?? o.id ?? ''), label: String(o.label ?? o.name ?? o.value ?? '') }))
          .filter(o => o.value))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [endpoint])

  return (
    <select value={(value as string) ?? ''} onChange={e => onChange(fieldKey, e.target.value)}
      aria-label={fieldKey}
      style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: 13, color: 'var(--text)', outline: 'none', cursor: 'pointer' }}>
      <option value="">{t('fields.selectPlaceholder')}</option>
      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ── Filters field ───────────────────────────────────────────────────────────────
// Inline conditions builder (field / operator / value + AND-OR), used inside an
// entity module so fetch + filter live in one module. Shares FilterFieldPicker +
// OperatorSelect with the edge-filter modal (FILTER-VELD-1); `field.fields`
// supplies the selectable field list. The standalone Filter/Router between
// modules stays untouched (for multi-status branching).
export function FiltersField({ field, value, onChange }: { field: WorkflowField; value?: EdgeFilters; onChange: OnChange }) {
  const { t } = useTranslation('workflows')
  const logic = value?.logic ?? 'AND'
  const conds: FilterCondition[] = Array.isArray(value?.conditions) ? value!.conditions! : []
  // This entity module's own filterable fields (its own type — not an upstream
  // chain, since the module fetches/updates its own records) — translated via
  // the shared fieldLabel() convention, fed into the same FilterFieldPicker the
  // edge-filter modal uses (FILTER-VELD-1) so field+"Toon als" behave identically.
  const fieldOptions = (field.fields ?? []).map(o => {
    const v = typeof o === 'object' ? o.value : o
    const l = typeof o === 'object' ? o.label : o
    return { value: String(v), label: fieldLabel(t, l as string) }
  })

  const set      = (next: EdgeFilters)        => onChange(field.key, next)
  const setLogic = (l: string)                => set({ logic: l, conditions: conds })
  const add      = ()                         => set({ logic, conditions: [...conds, { field: '', operator: '=', value: '' }] })
  const del      = (i: number)                => set({ logic, conditions: conds.filter((_, j) => j !== i) })
  const upd      = (i: number, k: keyof FilterCondition, v: string) => set({ logic, conditions: conds.map((c, j) => j === i ? { ...c, [k]: v } : c) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* AND / OR */}
      {conds.length > 1 && (
        <div style={{ display: 'flex', gap: 6 }}>
          {[['AND', t('fields.logicAll')], ['OR', t('fields.logicAny')]].map(([l, lbl]) => (
            <button key={l} type="button" onClick={() => setLogic(l)}
              style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 999, border: 'none', cursor: 'pointer',
                background: logic === l ? 'var(--color-primary)' : 'var(--border)', color: logic === l ? 'white' : 'var(--text-muted)' }}>{lbl}</button>
          ))}
        </div>
      )}
      {/* Condition rows — the field+"Toon als" picker gets its own full-width row
          (packs two controls); this panel is narrower than the edge-filter modal,
          so cramming it beside operator/value/delete truncated it to a sliver. */}
      {conds.map((c, i) => {
        const needsValue = !VALUELESS_OPERATORS.includes(normalizeOperator(c.operator))
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 6, border: '1px solid var(--border)', borderRadius: 6 }}>
            <FilterFieldPicker value={c.field ?? ''} options={fieldOptions} onChange={v => upd(i, 'field', v)} />
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <OperatorSelect value={normalizeOperator(c.operator)} onChange={v => upd(i, 'operator', v)}
                style={{ padding: '5px 4px' }} />
              {needsValue && (
                <input value={c.value ?? ''} onChange={e => upd(i, 'value', e.target.value)} placeholder={t('fields.valuePlaceholder')} aria-label={t('fields.valuePlaceholder')}
                  style={{ flex: 1, minWidth: 0, padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
              )}
              <button type="button" onClick={() => del(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', padding: 2, display: 'flex' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}><X size={13} /></button>
            </div>
          </div>
        )
      })}
      <button type="button" onClick={add}
        style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-primary)', background: 'none', border: '1px dashed var(--color-primary)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer' }}>
        <Plus size={10} /> {t('fields.addCondition')}
      </button>
    </div>
  )
}

// ── Response structure builder ─────────────────────────────────────────────────

const RS_TYPES = ['Text', 'Number', 'Boolean', 'Date', 'Array', 'Collection', 'Any']

export function ResponseStructureField({ value, onChange, fieldKey }: { value?: unknown; onChange: OnChange; fieldKey: string }) {
  const { t } = useTranslation('workflows')
  const items = (Array.isArray(value) ? value : []) as Array<{ name?: string; type?: string }>

  const add    = ()                                       => onChange(fieldKey, [...items, { name: '', type: 'Text' }])
  const remove = (i: number)                              => onChange(fieldKey, items.filter((_, j) => j !== i))
  const update = (i: number, k: 'name' | 'type', v: string) => onChange(fieldKey, items.map((item, j) => j === i ? { ...item, [k]: v } : item))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 22px', gap: 4, padding: '0 2px', marginBottom: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('fields.itemName')}</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('fields.typeLabel')}</div>
          <div />
        </div>
      )}
      {items.map((item, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 22px', gap: 4, alignItems: 'center' }}>
          <input value={item.name} onChange={e => update(i, 'name', e.target.value)}
            placeholder={t('fields.itemNamePlaceholder')} aria-label={t('fields.itemName')}
            style={{ padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none', minWidth: 0 }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
          <select value={item.type} onChange={e => update(i, 'type', e.target.value)}
            aria-label={t('fields.typeLabel')}
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
        <Plus size={10} /> {t('fields.addItem')}
      </button>
    </div>
  )
}
