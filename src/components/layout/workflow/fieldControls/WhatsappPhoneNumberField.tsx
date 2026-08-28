/**
 * WhatsApp phone number field — CMBE K-193 fase 0: GET /whatsapp-phone-numbers
 * options now carry a `coexistence` flag. When the sibling `channel` field is
 * 'waba_coex' the list is filtered to Coexistence-only numbers; the currently
 * stored value stays visible even if it falls outside that filter (§3 no
 * silent clear of a saved value). Split out of the former fieldControls.tsx monolith (§3 400-line split trigger).
 */
import { useState, useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { unwrapList } from '@/lib/api'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { Caption } from '@/components/ui/typography'
import ErrorBanner from '@/components/ui/ErrorBanner'
import type { OnChange } from './types'

// ── WhatsApp phone number field ─────────────────────────────────────────────────
export function WhatsappPhoneNumberField({ value, onChange, fieldKey, endpoint, config }: {
  value?: unknown; onChange: OnChange; fieldKey: string; endpoint: string; config?: Record<string, unknown>
}) {
  const { t } = useTranslation('workflows')
  const [opts, setOpts] = useState<Array<{ value: string; label: string; coexistence: boolean }>>([])
  // A failed load must read as an error, never as an honestly-empty number list (R8/§3 four states).
  const [error, setError] = useState(false)
  const [retryTick, setRetryTick] = useState(0)
  const phoneLabelId = useId()

  // Load the tenant's WABA sender numbers, keeping the coexistence flag per option.
  useEffect(() => {
    if (!endpoint) return
    let alive = true
    setError(false)
    import('@/lib/api').then(m => m.default.get(endpoint))
      .then(r => {
        const rows = unwrapList<Record<string, unknown>>(r).rows
        if (alive) setOpts(rows
          .map(o => ({ value: String(o.value ?? o.id ?? ''), label: String(o.label ?? o.name ?? o.value ?? ''), coexistence: !!o.coexistence }))
          .filter(o => o.value))
      })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [endpoint, retryTick])

  const filterActive = config?.channel === 'waba_coex'
  const filtered = filterActive ? opts.filter(o => o.coexistence) : opts
  // Keep a stored value visible even when the filter would otherwise drop it.
  const current = String(value ?? '')
  const list = current && !filtered.some(o => o.value === current)
    ? [...filtered, ...opts.filter(o => o.value === current)]
    : filtered

  if (error) return <ErrorBanner onRetry={() => setRetryTick(n => n + 1)}>{t('common:errorGeneric')}</ErrorBanner>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span id={phoneLabelId} className="sr-only">{fieldKey}</span>
      <CreatableSelect value={current} onChange={v => onChange(fieldKey, v)}
        aria-labelledby={phoneLabelId} allowCreate={false}
        placeholder={t('fields.selectPlaceholder')}
        options={[{ value: '', label: t('fields.selectPlaceholder') }, ...list]}
        style={{ width: '100%', padding: '7px 9px', fontSize: 13 }} />
      {filterActive && <Caption as="div">{t('fields.coexistenceOnly')}</Caption>}
    </div>
  )
}
