/**
 * PopoutShell — shared four-state shell (§3) for every second-screen notes popout
 * (candidate/customer/vacancy, F5-uitbreiding): a loading skeleton, an error+retry
 * row, and on success a calm avatar+name header above whatever notes surface the
 * entity page passes as children. One shell, one look — extends the original
 * candidate-only NotesPopoutPage markup instead of re-implementing the same
 * skeleton/header/error three times per entity.
 */
import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'

interface PopoutShellProps {
  loading: boolean
  // True when the entity identity itself failed to load (bad/stale id, network).
  // Notes themselves degrade quietly inside the notes hook — this state means
  // "we don't even know whose notes these are", so it blocks the whole surface.
  error: boolean
  loadingLabel: string
  errorLabel: string
  retryLabel: string
  onRetry: () => void
  name: string
  initials: string
  subtitle: string
  children: ReactNode
  // VAC-NOTES-CALM-1 (Danny 14-08, PDF-VACATURES point 28): the vacancy notes
  // popout drops the avatar+name row — the OS window title (document.title,
  // set by the host page) already names the vacancy, so repeating it here read
  // as noise; the header collapses to the calm section-label look the
  // candidate profile-text block uses ("Summary"/"Notes", not the entity name).
  // Optional and defaults to false: every other current caller (candidate/
  // customer notes + the candidate summary popout) keeps its avatar+name header
  // unchanged.
  hideEntityName?: boolean
}

// Header + notes-area placeholder while the entity identity loads — never a
// blank window (§3: always handle loading explicitly).
export function PopoutSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div aria-busy="true" aria-live="polite" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span className="sr-only">{loadingLabel}</span>
      <div className="animate-pulse" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--hover-bg)' }} />
        <div style={{ height: 14, width: 160, borderRadius: 4, background: 'var(--hover-bg)' }} />
      </div>
      <div className="animate-pulse" style={{ height: 34, borderRadius: 8, background: 'var(--hover-bg)' }} />
      <div className="animate-pulse" style={{ height: 64, borderRadius: 8, background: 'var(--hover-bg)' }} />
      <div className="animate-pulse" style={{ height: 64, borderRadius: 8, background: 'var(--hover-bg)' }} />
    </div>
  )
}

// Full-viewport error row with a retry button — the entity identity fetch failed.
function PopoutErrorRow({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', gap: 10, padding: 24, textAlign: 'center' }}>
      <AlertTriangle size={22} style={{ color: 'var(--color-danger-text)' }} aria-hidden="true" />
      <p style={{ fontSize: 13, color: 'var(--text)' }}>{message}</p>
      <button onClick={onRetry} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6,
        padding: '5px 12px', fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
        {retryLabel}
      </button>
    </div>
  )
}

// Loading → skeleton; error → retry row; success → calm avatar+name header above
// the entity page's own notes surface (children).
export default function PopoutShell({ loading, error, loadingLabel, errorLabel, retryLabel, onRetry, name, initials, subtitle, children, hideEntityName = false }: PopoutShellProps) {
  if (loading) return <PopoutSkeleton loadingLabel={loadingLabel} />
  if (error) return <PopoutErrorRow message={errorLabel} retryLabel={retryLabel} onRetry={onRetry} />

  return (
    // height (not minHeight) on purpose (Danny 09-08: "tekst blok blijft klein").
    // A percentage height only resolves against a DEFINITE parent height; with
    // minHeight the body's flex:1 stayed auto, so the editor's own height:100%
    // collapsed to its content and left the rest of the window empty.
    <div style={{ height: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* VAC-NOTES-CALM-1: hideEntityName swaps the avatar+name identity row for
          the same calm uppercase section-label the candidate profile-text block
          uses — the window title already carries the entity name, so this header
          only needs to say WHAT the surface is, not WHOSE it is. */}
      {hideEntityName ? (
        <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            {subtitle}
          </span>
        </header>
      ) : (
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
          borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <Avatar initials={initials} soft size={32} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</div>
          </div>
        </header>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 20 }}>{children}</div>
    </div>
  )
}
