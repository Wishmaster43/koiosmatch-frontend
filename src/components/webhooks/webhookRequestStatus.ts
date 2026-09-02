/**
 * webhookRequestStatus — the three documented status semantics for an inbound
 * webhook hit (K-117): 200 received/no-match, 202 workflows queued, 401 signature
 * rejected (danger). Anything else still renders, tinted neutral. Shared by the
 * list's status column and the detail panel's summary chip so both agree.
 */
export function statusChipColor(code: number): string {
  if (code === 200) return 'var(--color-success)'
  if (code === 202) return 'var(--color-info)'
  if (code === 401) return 'var(--color-danger)'
  return 'var(--text-muted)'
}

// i18n key suffix (webhooks.incoming.requests.status.<key>) for the tooltip text.
export function statusLabelKey(code: number): 'received' | 'queued' | 'rejected' | 'other' {
  if (code === 200) return 'received'
  if (code === 202) return 'queued'
  if (code === 401) return 'rejected'
  return 'other'
}
