import { Component } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/**
 * ErrorBoundary — catches render-time crashes in its subtree so one broken widget
 * never blanks the whole app (CLAUDE.md §3). Use one global boundary at the root
 * and local ones around heavy/risky widgets (charts, drawers, the workflow canvas).
 *
 * Privacy (§8): the raw error is NEVER shown to the user (it may carry server detail
 * or PII) — a generic message is rendered; the technical text is dev-only.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  // Flip into the fallback render on the next paint.
  static getDerivedStateFromError(error) {
    return { error }
  }

  // Hook for future telemetry (must stay PII-safe); intentionally no console here.
  componentDidCatch(error, info) {
    this.props.onError?.(error, info)
  }

  // Clear the error so the subtree re-mounts and can recover.
  reset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.error == null) return this.props.children
    // Allow a custom fallback; otherwise the default token-styled panel.
    if (this.props.fallback) return this.props.fallback(this.state.error, this.reset)
    return <ErrorFallback error={this.state.error} onReset={this.reset} compact={this.props.compact} />
  }
}

// Default fallback — calm, token-only styling; hooks live here (class can't use them).
function ErrorFallback({ error, onReset, compact }) {
  const { t } = useTranslation('common')
  return (
    <div role="alert" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, textAlign: 'center', padding: compact ? '24px 16px' : '64px 24px',
      minHeight: compact ? 0 : 240, color: 'var(--text)' }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44,
        borderRadius: 12, background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
        <AlertTriangle size={22} />
      </span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{t('error.title')}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, maxWidth: 360 }}>{t('error.body')}</div>
      </div>
      <button onClick={onReset} style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', fontSize: 13, fontWeight: 500,
        borderRadius: 8, cursor: 'pointer', border: '1px solid var(--color-primary)',
        background: 'var(--color-primary)', color: 'white' }}>
        <RotateCcw size={14} /> {t('error.retry')}
      </button>
      {/* Technical detail is dev-only — never leak server detail/PII in production (§8). */}
      {import.meta.env.DEV && error?.message && (
        <details style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', maxWidth: 480 }}>
          <summary style={{ cursor: 'pointer' }}>{t('error.details')}</summary>
          <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left', marginTop: 6 }}>{String(error.message)}</pre>
        </details>
      )}
    </div>
  )
}
