/**
 * Lookup-backed select — options come from a tenant lookup endpoint (e.g.
 * /whatsapp-message-types) instead of a hardcoded list (§10: no hardcoded
 * vocabularies in workflow nodes). Split out of the former fieldControls.tsx monolith (§3 400-line split trigger).
 */
import { useState, useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { unwrap, unwrapList } from '@/lib/api'
import CreatableSelect from '@/components/ui/CreatableSelect'
import ErrorBanner from '@/components/ui/ErrorBanner'
import type { OnChange } from './types'

// ── Lookup-backed select ────────────────────────────────────────────────────────
export function LookupSelectField({ value, onChange, fieldKey, endpoint, valueKey, responseKey, emptyLabel }: {
  // valueKey: which row property becomes the STORED value. Roles resolve server-side
  // by roles.name (NotificationSendModule::resolveRecipients), so the role field
  // stores the name — a numeric Spatie id would silently match nobody (§3)
  // responseKey: for endpoints that return an OBJECT of collections (GET
  // /settings/candidate-lookups → {statuses, phases, …}) — the collection to read;
  // omitted = the response is a plain list (WF-BUILDER-VELDEN-1 Opus fix).
  // emptyLabel: schema-driven override for the blank/clear option's copy (VAC-CLEAR-1) —
  // e.g. interview_start's "default from the vacancy/application" — falls back to the
  // generic select placeholder when the schema doesn't specify one.
  value?: unknown; onChange: OnChange; fieldKey: string; endpoint: string; valueKey?: string; responseKey?: string; emptyLabel?: string
}) {
  const { t } = useTranslation('workflows')
  const [opts, setOpts] = useState<Array<{ value: string; label: string }>>([])
  // A failed load must read as an error, never as an honestly-empty lookup (R8/§3 four states).
  const [error, setError] = useState(false)
  const [retryTick, setRetryTick] = useState(0)
  // CreatableSelect's trigger is a <button>, which a plain aria-label cannot
  // name — a sr-only span + aria-labelledby names it instead (§4).
  const lookupLabelId = useId()

  // Load the lookup values once; accept the common {value|id, label|name} shapes.
  // K-193 fase 2b: an endpoint may also carry `owner` (user or branch name) and
  // `scope` ('user'|'location') per option (GET /whatsapp-web-numbers) — kept
  // additively onto the server's own label, never dropped, so the picker reads
  // "<label> · <owner>" instead of a bare device name.
  useEffect(() => {
    if (!endpoint) return
    let alive = true
    setError(false)
    import('@/lib/api').then(m => m.default.get(endpoint))
      .then(r => {
        const rows = (responseKey
          ? ((unwrap(r) as Record<string, unknown> | null)?.[responseKey] ?? [])
          : unwrapList(r).rows) as Array<Record<string, unknown>>
        if (alive) setOpts(rows
          .map(o => {
            const value = String((valueKey ? o[valueKey] : undefined) ?? o.value ?? o.id ?? '')
            const label = String(o.label ?? o.name ?? o.value ?? '')
            const owner = typeof o.owner === 'string' && o.owner ? o.owner : undefined
            return { value, label: owner ? `${label} · ${owner}` : label }
          })
          .filter(o => o.value))
      })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [endpoint, valueKey, responseKey, retryTick])

  if (error) return <ErrorBanner onRetry={() => setRetryTick(n => n + 1)}>{t('common:errorGeneric')}</ErrorBanner>

  // CMBE delta 2026-08-30: ai_agent's `agent` field was renamed `agent_id`
  // (a real id-valued lookup), but the engine still resolves the OLD name-valued
  // `agent` key (AiAgentModule.php:154) until that backend delta lands. This is
  // the only place the agent's NAME is in scope (it comes from this same lookup
  // payload), so dual-write the legacy key here for one release — see
  // ai_agent.ts's docblock. No other lookup_select field carries this key.
  const handleChange = (v: string) => {
    onChange(fieldKey, v)
    if (fieldKey === 'agent_id') onChange('agent', opts.find(o => o.value === v)?.label ?? '')
  }

  return (
    <>
      {/* No visible label wraps this field (schema-driven, key is the only name
          available here) — kept as the accessible name text, same as before. */}
      <span id={lookupLabelId} className="sr-only">{fieldKey}</span>
      {/* The search input's accessible NAME stays the neutral select-copy —
          emptyLabel only labels the ''-option (naming the input after one
          option was a §6 regression, verify r2). */}
      <CreatableSelect value={(value as string) ?? ''} onChange={handleChange}
        aria-labelledby={lookupLabelId} allowCreate={false}
        placeholder={t('fields.selectPlaceholder')}
        options={[{ value: '', label: emptyLabel ?? t('fields.selectPlaceholder') }, ...opts]}
        style={{ width: '100%', padding: '7px 9px', fontSize: 13 }} />
    </>
  )
}
