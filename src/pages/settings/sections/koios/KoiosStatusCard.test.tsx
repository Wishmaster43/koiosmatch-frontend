/**
 * KoiosStatusCard — behaviour test (§13: was the lone card in this folder with
 * no companion test; index.test.tsx only stubs it). Covers the three indicator
 * branches, the conditional api_ok row, and that api_error is never rendered.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import KoiosStatusCard from './KoiosStatusCard'
import type { TFn } from '@/types/koios'

// t stub returns the raw key so assertions read exactly what the component asked for.
const t: TFn = (key) => key

describe('KoiosStatusCard', () => {
  it('shows connected/loaded verdicts when both flags are true', () => {
    render(<KoiosStatusCard status={{ claude_configured: true, policy_loaded: true }} t={t} />)
    expect(screen.getByText('status.connected')).toBeInTheDocument()
    expect(screen.getByText('status.loaded')).toBeInTheDocument()
  })

  it('shows not-connected/not-loaded verdicts when both flags are false', () => {
    render(<KoiosStatusCard status={{ claude_configured: false, policy_loaded: false }} t={t} />)
    expect(screen.getByText('status.notConnected')).toBeInTheDocument()
    expect(screen.getByText('status.notLoaded')).toBeInTheDocument()
  })

  // api_ok present-true renders the live indicator as healthy.
  it('renders the live indicator as ok when api_ok is true', () => {
    render(<KoiosStatusCard status={{ claude_configured: true, policy_loaded: true, api_ok: true }} t={t} />)
    expect(screen.getByText('status.liveOk')).toBeInTheDocument()
  })

  // api_ok present-false renders the live indicator as failing.
  it('renders the live indicator as bad when api_ok is false', () => {
    render(<KoiosStatusCard status={{ claude_configured: true, policy_loaded: true, api_ok: false }} t={t} />)
    expect(screen.getByText('status.liveBad')).toBeInTheDocument()
  })

  // api_ok absent means "not yet checked" — the row must not render at all.
  it('does not render the live indicator row when api_ok is absent', () => {
    render(<KoiosStatusCard status={{ claude_configured: true, policy_loaded: true }} t={t} />)
    expect(screen.queryByText('status.liveOk')).not.toBeInTheDocument()
    expect(screen.queryByText('status.liveBad')).not.toBeInTheDocument()
  })

  // api_error is a raw, untranslated backend string (§5) — it must never reach the DOM.
  it('never renders the raw api_error string', () => {
    render(<KoiosStatusCard status={{ claude_configured: true, policy_loaded: true, api_ok: false, api_error: 'raw backend exception text' }} t={t} />)
    expect(screen.queryByText('raw backend exception text')).not.toBeInTheDocument()
  })

  // Missing status block entirely still renders honest "not ok" verdicts, never a crash.
  it('handles a missing status block as all-false, no live row', () => {
    render(<KoiosStatusCard status={null} t={t} />)
    expect(screen.getByText('status.notConnected')).toBeInTheDocument()
    expect(screen.getByText('status.notLoaded')).toBeInTheDocument()
    expect(screen.queryByText('status.liveOk')).not.toBeInTheDocument()
    expect(screen.queryByText('status.liveBad')).not.toBeInTheDocument()
  })
})
