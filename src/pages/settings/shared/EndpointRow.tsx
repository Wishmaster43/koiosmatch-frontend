/**
 * EndpointRow — a grid row (slug | URL input | action button) with shared styling
 * for the endpoint list (webhooks + any other endpoint-style settings).
 * Extracted to avoid duplication between EndpointRow and NewEndpointRow in
 * WorkflowEndpointsCard.
 */
import { ReactNode } from 'react'

interface EndpointRowGridProps {
  slugCol: ReactNode
  urlCol: ReactNode
  actionCol: ReactNode
  error?: string
  marginBottom?: number
}

// Grid row: 140px slug | 1fr URL | 32px action, with optional error message below.
export function EndpointRowGrid({ slugCol, urlCol, actionCol, error, marginBottom = 12 }: EndpointRowGridProps) {
  return (
    <div style={{ marginBottom, paddingBottom: marginBottom, borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 32px', gap: 10, alignItems: 'center' }}>
        {slugCol}
        {urlCol}
        {actionCol}
      </div>
      {error && (
        <div style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  )
}
