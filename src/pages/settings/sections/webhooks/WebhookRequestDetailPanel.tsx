/**
 * WebhookRequestDetailPanel — one inbound webhook request in full: filtered
 * headers (masked ones as a chip), query, body and response_body. Opens as a
 * second FloatingPanel above the requests list (draggable/resizable, stacks by
 * itself — see FloatingPanel's own z-index claim). A request resolved under the
 * WRONG parent webhook 404s (kind-door-ouder, IDOR) — that renders its own
 * honest "not found" state, distinct from a generic load error.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Button from '@/components/ui/Button'
import SoftChip from '@/components/ui/SoftChip'
import Spinner from '@/components/ui/Spinner'
import CalloutBox from '@/components/ui/CalloutBox'
import WorkflowRefs from './WorkflowRefs'
import { Caption, GroupLabel, Mono } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { getWebhookRequest } from './webhooksApi'
import { statusChipColor } from './webhookRequestStatus'
import type { WebhookRequestDetail } from './webhookRequestTypes'

const MASKED = '[MASKED]'

// One monospace block (body / response_body) with a copy-to-clipboard button.
function CodeBlock({ value, emptyLabel, copyLabel }: { value: string | null; emptyLabel: string; copyLabel: string }) {
  const [copied, setCopied] = useState(false)
  // The "copied" flash resets after 2s — cleared on unmount so closing the panel
  // within that window never sets state on a dead component (Opus nit).
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Clears the pending copied-flash timeout on unmount.
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])
  // Copies the value to the clipboard and flashes a copied confirmation for 2 seconds.
  const copy = () => {
    void navigator.clipboard?.writeText(value ?? '')
    setCopied(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), 2000)
  }
  if (!value) return <Caption>{emptyLabel}</Caption>
  return (
    <div style={{ position: 'relative' }}>
      <Mono as="pre" style={{ margin: 0, padding: '10px 36px 10px 10px', fontSize: 11.5,
        background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 260, overflow: 'auto' }}>
        {value}
      </Mono>
      <Button variant="secondary" size="sm" iconOnly onClick={copy} aria-label={copyLabel} title={copyLabel}
        style={{ position: 'absolute', top: 6, right: 6 }}>
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </Button>
    </div>
  )
}

// One key/value row (headers / query) — a masked header renders as a chip.
function KeyValueRow({ label, value, maskedTitle }: { label: string; value: string; maskedTitle: string }) {
  const masked = value === MASKED
  return (
    <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--hover-bg)' }}>
      <Mono style={{ fontSize: 11.5, color: 'var(--text-muted)', width: 170, flexShrink: 0, wordBreak: 'break-all' }}>{label}</Mono>
      {masked
        ? <SoftChip label={MASKED} color="var(--color-warning)" title={maskedTitle} />
        : <Mono style={{ fontSize: 11.5, color: 'var(--text)', wordBreak: 'break-all' }}>{value}</Mono>}
    </div>
  )
}

// Floating panel showing one webhook request full detail (headers/query/body/response), fetched by id with an explicit notFound/error phase alongside loading/ready.
export default function WebhookRequestDetailPanel({ webhookId, requestId, onClose }: {
  webhookId: string | number
  requestId: string | number
  onClose: () => void
}) {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useDateFormat()
  const [detail, setDetail] = useState<WebhookRequestDetail | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'notFound' | 'error'>('loading')
  const aliveRef = useRef(true)

  // Fetch the single request; a 404 (wrong parent webhook) gets its own honest state.
  useEffect(() => {
    aliveRef.current = true
    setPhase('loading')
    // webhooksApi.js is untyped (checkJs off); unwrap's generic defaults to
    // `unknown` there, so the resolved shape is asserted here (§10: hand-written,
    // the spec carries no 2xx schema for this endpoint yet).
    getWebhookRequest(webhookId, requestId)
      .then((data) => { if (aliveRef.current) { setDetail(data as WebhookRequestDetail); setPhase('ready') } })
      .catch((err: unknown) => {
        if (!aliveRef.current) return
        const status = (err as { response?: { status?: number } })?.response?.status
        setPhase(status === 404 ? 'notFound' : 'error')
      })
    return () => { aliveRef.current = false }
  }, [webhookId, requestId])

  const headerEntries = detail ? Object.entries(detail.headers ?? {}) : []
  const queryEntries = detail ? Object.entries(detail.query ?? {}) : []

  return (
    <FloatingPanel open onClose={onClose} title={t('webhooks.incoming.requests.detail.title', { id: requestId })}
      width={640} persistKey="webhook-request-detail" bodyStyle={{ padding: '16px 20px' }}>
      {phase === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          <Spinner size={14} /> {t('webhooks.incoming.requests.detail.loading')}
        </div>
      )}

      {phase === 'notFound' && (
        <CalloutBox variant="warning">{t('webhooks.incoming.requests.detail.notFound')}</CalloutBox>
      )}
      {phase === 'error' && (
        <CalloutBox variant="danger">{t('webhooks.incoming.requests.detail.loadError')}</CalloutBox>
      )}

      {phase === 'ready' && detail && (
        <>
          {/* Summary line: method, status, received-at */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <Mono style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{detail.method}</Mono>
            <SoftChip label={detail.status_code} color={statusChipColor(detail.status_code)} />
            <Caption>{t('webhooks.incoming.requests.detail.receivedAt')}: {formatDateTime(detail.created_at)}</Caption>
          </div>

          {/* Matched workflows (WorkflowRefs): WEBHOOK-RUN-CORRELATION-1 named
              workflows link straight to their own filtered run history; older
              rows without names fall back to the honest ids-only reference. */}
          {((detail.workflow_ids ?? []).length > 0 || (detail.workflows?.length ?? 0) > 0) && (
            <div style={{ marginBottom: 16 }}>
              <GroupLabel style={{ marginBottom: 6 }}>{t('webhooks.incoming.requests.detail.workflows')}</GroupLabel>
              <WorkflowRefs ids={detail.workflow_ids ?? []} workflows={detail.workflows} />
            </div>
          )}

          {/* Headers — filtered by the backend; masked entries render as a chip. */}
          <div style={{ marginBottom: 16 }}>
            <GroupLabel style={{ marginBottom: 6 }}>{t('webhooks.incoming.requests.detail.headers')}</GroupLabel>
            {headerEntries.length === 0
              ? <Caption>{t('webhooks.incoming.requests.detail.noHeaders')}</Caption>
              : headerEntries.map(([k, v]) => (
                  <KeyValueRow key={k} label={k} value={v} maskedTitle={t('webhooks.incoming.requests.detail.maskedTooltip')} />
                ))}
          </div>

          {/* Query parameters */}
          <div style={{ marginBottom: 16 }}>
            <GroupLabel style={{ marginBottom: 6 }}>{t('webhooks.incoming.requests.detail.query')}</GroupLabel>
            {queryEntries.length === 0
              ? <Caption>{t('webhooks.incoming.requests.detail.noQuery')}</Caption>
              : queryEntries.map(([k, v]) => (
                  <KeyValueRow key={k} label={k} value={v} maskedTitle={t('webhooks.incoming.requests.detail.maskedTooltip')} />
                ))}
          </div>

          {/* Body — capped at 64KB server-side. */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <GroupLabel>{t('webhooks.incoming.requests.detail.body')}</GroupLabel>
              <Caption>{t('webhooks.incoming.requests.detail.bodyCap')}</Caption>
            </div>
            <CodeBlock value={detail.body} emptyLabel={t('webhooks.incoming.requests.detail.noBody')}
              copyLabel={t('webhooks.incoming.requests.detail.copy')} />
          </div>

          {/* Response body */}
          <div>
            <GroupLabel style={{ marginBottom: 6 }}>{t('webhooks.incoming.requests.detail.response')}</GroupLabel>
            <CodeBlock value={detail.response_body} emptyLabel={t('webhooks.incoming.requests.detail.noResponse')}
              copyLabel={t('webhooks.incoming.requests.detail.copy')} />
          </div>
        </>
      )}
    </FloatingPanel>
  )
}
