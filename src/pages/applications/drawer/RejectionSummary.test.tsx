/**
 * RejectionSummary — the calm, READ-ONLY outcome card (Danny 25-07). Covers:
 * nothing renders without a rejection, the reason + meta line (sent-on/channel)
 * render when present, the not-sent fallback line, and the read-only guarantee
 * (no button at all — there is no safe edit path, see the component docblock).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RejectionSummary from './RejectionSummary'
import type { ApplicationDetail } from '@/types/application'

// Key-echo (repo-wide precedent, e.g. ApplicationTab.test.tsx) — avoids the
// real i18n instance's async-init timing flipping assertions between raw keys
// and translated NL copy depending on run order. `defaultValue` on the channel
// key is intentionally ignored here (t is a pure key-echo), matching how a
// literal key would render when no translation resource has loaded yet.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// useDateFormat (@/lib/datetime) imports `@/i18n`, which needs a REAL
// react-i18next (initReactI18next) to initialise — stub the whole module
// (mirrors ApplicationTab.test.tsx) so nothing here touches the real singleton.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (d: unknown) => (d ? String(d) : '—'), formatDateTime: (d: unknown) => (d ? String(d) : '—') }),
  useLocale: () => 'nl-NL',
}))

const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, bucket: 'rejected', ...over,
} as unknown as ApplicationDetail)

describe('RejectionSummary', () => {
  it('renders nothing for an application that is not rejected', () => {
    const { container } = render(<RejectionSummary application={app({ bucket: 'active', rejection: undefined })} />)
    expect(container).toBeEmptyDOMElement()
  })

  // A phase move (or the seeder) can land an application in the rejected bucket
  // with NO rejection record — measured live 25-07. Showing nothing would read as
  // "no data"; this states the gap instead. Still read-only.
  it('states the gap when the application is rejected without a recorded reason', () => {
    render(<RejectionSummary application={app({ bucket: 'rejected', rejection: undefined })} />)
    expect(screen.getByText('rejection.rejected')).toBeInTheDocument()
    expect(screen.getByText('rejection.noRecord')).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('shows the reason, "verstuurd op" and the channel when all are present', () => {
    render(<RejectionSummary application={app({
      rejection: { reason_label: 'Niet gekwalificeerd', sent_at: '2026-07-20T10:00:00Z', channel: 'email' },
    })} />)
    expect(screen.getByText('rejection.rejected')).toBeInTheDocument()
    expect(screen.getByText('Niet gekwalificeerd')).toBeInTheDocument()
    expect(screen.getByText('rejection.sentOn · rejection.viaChannel')).toBeInTheDocument()
  })

  it('shows the not-sent line when sent_at is null', () => {
    render(<RejectionSummary application={app({ rejection: { reason_label: 'Te ver weg', sent_at: null } })} />)
    expect(screen.getByText('rejection.notSent')).toBeInTheDocument()
  })

  it('renders no button at all — the read-only guarantee', () => {
    render(<RejectionSummary application={app({
      rejection: { reason_label: 'Niet gekwalificeerd', note: 'Geen ervaring', sent_at: '2026-07-20T10:00:00Z', channel: 'email' },
    })} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
