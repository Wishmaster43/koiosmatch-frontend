/**
 * ArchiveGuardModal — regression test for HERAUDIT-2-REST-b: the "resolve all"
 * button must thread the live tenant funnelTypes lookup into resolveApplication,
 * so its PATCH carries the tenant's actual renamed is_rejected slug, never the
 * seed 'rejected' default.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import i18nInstance from 'i18next'
import api from '@/lib/api'
import ArchiveGuardModal from './ArchiveGuardModal'
import type { LookupItem } from '@/context/LookupsContext'

// Minimal i18n instance so t() resolves to stable keys for assertions (mirrors
// PersonalCard.test.tsx's approach).
// N012: one real resource so the server-message interpolation can be proven
// to actually reach the screen — every other key stays an unresolved raw key.
i18nInstance.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { candidates: { archiveGuard: { applicationFailed: 'Not rejected: {{message}}' } } } },
  interpolation: { escapeValue: false },
  returnNull: false, returnEmptyString: false,
})

// A tenant that renamed the rejected funnel slug away from the seed default.
const RENAMED_FUNNEL: LookupItem[] = [
  { value: 'afgewezen_x', label: 'Afgewezen', color: 'var(--text-muted)', is_rejected: true },
]

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn().mockResolvedValue({}), delete: vi.fn().mockResolvedValue({}) } }
})

// N012: a stub tenant rejection-reason list, same shape useRejectionReasons returns.
vi.mock('@/lib/useRejectionReasons', () => ({
  useRejectionReasons: () => ({ reasons: [{ value: 'r1', label: 'Niet beschikbaar' }], loading: false }),
}))

afterEach(() => vi.clearAllMocks())

// N012: opens the reason picker and picks the (only) stub reason.
const pickReason = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'archiveGuard.rejectionReason' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Niet beschikbaar' }))
}

const renderModal = (funnelTypes?: LookupItem[]) => render(
  <I18nextProvider i18n={i18nInstance}>
    <ArchiveGuardModal
      mode="archive"
      candidateName="Jan Jansen"
      applications={[{ id: 'a1', vacancyTitle: 'Verpleegkundige', stageLabel: 'Gesolliciteerd', stageColor: null }]}
      matches={[]}
      funnelTypes={funnelTypes}
      onClose={() => {}}
      onResolved={() => {}}
    />
  </I18nextProvider>,
)

describe('ArchiveGuardModal resolve-all', () => {
  it('PATCHes the tenant-renamed is_rejected slug when funnelTypes is threaded through', async () => {
    renderModal(RENAMED_FUNNEL)
    await pickReason()
    fireEvent.click(screen.getByRole('button', { name: 'archiveGuard.resolveButtonArchive' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/applications/a1', { phase_key: 'afgewezen_x', rejection_reason_id: 'r1' }))
  })

  it('falls back to the seed rejected slug when no funnelTypes prop is passed', async () => {
    renderModal(undefined)
    await pickReason()
    fireEvent.click(screen.getByRole('button', { name: 'archiveGuard.resolveButtonArchive' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/applications/a1', { phase_key: 'rejected', rejection_reason_id: 'r1' }))
  })

  // N012: the resolve button stays disabled while applications are present and
  // no reason has been picked yet — no PATCH ever fires.
  it('disables resolve until a rejection reason is picked', () => {
    renderModal(undefined)
    expect(screen.getByRole('button', { name: 'archiveGuard.resolveButtonArchive' })).toBeDisabled()
  })

  // N012: applications reject with the reason FIRST; matches are only ended
  // once every application resolved cleanly.
  it('rejects the application with the picked reason, then ends the match only after that succeeds', async () => {
    render(
      <I18nextProvider i18n={i18nInstance}>
        <ArchiveGuardModal mode="archive" candidateName="Jan Jansen"
          applications={[{ id: 'a1', vacancyTitle: 'Verpleegkundige', stageLabel: 'Gesolliciteerd', stageColor: null }]}
          matches={[{ id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'ACME', statusKey: 'open' }]}
          onClose={() => {}} onResolved={() => {}} />
      </I18nextProvider>,
    )
    await pickReason()
    fireEvent.click(screen.getByRole('button', { name: 'archiveGuard.resolveButtonArchive' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/applications/a1', { phase_key: 'rejected', rejection_reason_id: 'r1' }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/matches/m1'))
  })

  // N012: the application PATCH fails (422, missing reason server-side) — no
  // DELETE on the match ever fires, the application stays listed with the
  // server message, and onResolved is never called.
  it('never ends the match when the application reject fails, and shows the server message', async () => {
    vi.mocked(api.patch).mockRejectedValue({ response: { status: 422, data: { message: 'Een afwijzing heeft een reden nodig.' } } })
    const onResolved = vi.fn()
    render(
      <I18nextProvider i18n={i18nInstance}>
        <ArchiveGuardModal mode="archive" candidateName="Jan Jansen"
          applications={[{ id: 'a1', vacancyTitle: 'Verpleegkundige', stageLabel: 'Gesolliciteerd', stageColor: null }]}
          matches={[{ id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'ACME', statusKey: 'open' }]}
          onClose={() => {}} onResolved={onResolved} />
      </I18nextProvider>,
    )
    await pickReason()
    fireEvent.click(screen.getByRole('button', { name: 'archiveGuard.resolveButtonArchive' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalled())
    expect(api.delete).not.toHaveBeenCalled()
    await screen.findByText('Not rejected: Een afwijzing heeft een reden nodig.')
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(onResolved).not.toHaveBeenCalled()
  })

  // Mustfix: a failure with no server message (network error, empty body)
  // still shows a fallback so the row is never silently unexplained.
  it('shows a fallback message when the reject fails with no server text', async () => {
    vi.mocked(api.patch).mockRejectedValue(new Error('net'))
    render(
      <I18nextProvider i18n={i18nInstance}>
        <ArchiveGuardModal mode="archive" candidateName="Jan Jansen"
          applications={[{ id: 'a1', vacancyTitle: 'Verpleegkundige', stageLabel: 'Gesolliciteerd', stageColor: null }]}
          matches={[]}
          onClose={() => {}} onResolved={() => {}} />
      </I18nextProvider>,
    )
    await pickReason()
    fireEvent.click(screen.getByRole('button', { name: 'archiveGuard.resolveButtonArchive' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalled())
    await screen.findByText('Not rejected: error.title')
  })
})
