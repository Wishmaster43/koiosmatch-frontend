/**
 * UrlRow — one copyable, openable public URL. Dumb/presentational (no i18n, no
 * business logic — the caller resolves every label): mirrors the house
 * copy-URL pattern from FacebookLeadsSettings/IncomingWebhooks.jsx (monospace
 * code chip + copy button), extended with an "open in a new tab" action and an
 * optional inactive notice so the career-site public/feed URLs share one look.
 */
import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'

interface UrlRowProps {
  label: string
  url: string
  /** Shown under the row when this endpoint currently 404s (career site off) — honest, not hidden. */
  notice?: string
  /** True while `notice` is set — the "open" action stays visible but non-navigating (no fake affordance). */
  disabledOpen?: boolean
  copyLabel: string
  copiedLabel: string
  openLabel: string
}

export default function UrlRow({ label, url, notice, disabledOpen, copyLabel, copiedLabel, openLabel }: UrlRowProps) {
  const [copied, setCopied] = useState(false)

  // Copy the URL with a 2s "copied" confirmation; guard environments without the Clipboard API
  // (older browsers / non-secure contexts) instead of throwing on click.
  const copy = () => {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--hover-bg)' }}>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <code style={{
          flex: 1, minWidth: 0, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
          background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 6,
          padding: '6px 10px', color: 'var(--text)', wordBreak: 'break-all',
        }}>
          {url}
        </code>
        {/* Real link (never a fake one) — disabled visually + non-navigating only while
            the notice below already explains it currently 404s (§3). */}
        {disabledOpen ? (
          <span aria-disabled="true" title={notice} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, flexShrink: 0,
            borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-muted)', opacity: 0.5,
          }}>
            <ExternalLink size={12} />
          </span>
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label={openLabel} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, flexShrink: 0,
            borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)',
          }}>
            <ExternalLink size={12} />
          </a>
        )}
        <button type="button" onClick={copy} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 11, fontWeight: 500,
          background: copied ? 'var(--color-success-bg)' : 'var(--hover-bg)',
          color: copied ? 'var(--color-success)' : 'var(--text)',
          border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      {notice && (
        <div style={{ fontSize: 11, color: 'var(--color-warning)', marginTop: 6 }}>{notice}</div>
      )}
    </div>
  )
}
