/**
 * FAQ multi-select field — the workflow FAQ-picker config control. Split out of
 * fieldControls/ (§3 400-line split trigger).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { unwrapList } from '@/lib/api'
import ErrorBanner from '@/components/ui/ErrorBanner'
import type { OnChange } from './types'

// ── FAQ multi-select field ─────────────────────────────────────────────────────
export function FaqSelectField({ value, onChange, fieldKey }: { value?: unknown; onChange: OnChange; fieldKey: string }) {
  const { t } = useTranslation('workflows')
  const [faqs,    setFaqs]    = useState<Array<{ id?: string | number; name?: string; title?: string }>>([])
  const [loading, setLoading] = useState(true)
  // A failed load must read as an error, never as "no FAQs configured" (R8/§3 four states).
  const [error,   setError]   = useState(false)
  const [retryTick, setRetryTick] = useState(0)
  const selected: unknown[] = Array.isArray(value) ? value : []

  // Loads the tenant's FAQ list once on mount; a failure surfaces the honest error state below instead of the empty-list copy.
  useEffect(() => {
    setLoading(true); setError(false)
    import('@/lib/api').then(m => m.default.get('/ai/faqs'))
      .then(r => setFaqs(unwrapList<{ id?: string | number; name?: string; title?: string }>(r).rows))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [retryTick])

  // Adds/removes one FAQ id from the selected set and writes the whole array back into the node config.
  const toggle = (id: string | number) => {
    const next = selected.includes(id) ? selected.filter(v => v !== id) : [...selected, id]
    onChange(fieldKey, next)
  }

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>{t('fields.faqLoading')}</div>
  if (error) return <ErrorBanner onRetry={() => setRetryTick(n => n + 1)}>{t('common:errorGeneric')}</ErrorBanner>
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
