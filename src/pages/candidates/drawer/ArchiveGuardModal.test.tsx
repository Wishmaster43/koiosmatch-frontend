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
i18nInstance.use(initReactI18next).init({
  lng: 'en', resources: {}, interpolation: { escapeValue: false },
  returnNull: false, returnEmptyString: false,
})

// A tenant that renamed the rejected funnel slug away from the seed default.
const RENAMED_FUNNEL: LookupItem[] = [
  { value: 'afgewezen_x', label: 'Afgewezen', color: 'var(--text-muted)', is_rejected: true },
]

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn().mockResolvedValue({}), delete: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

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
    fireEvent.click(screen.getByRole('button', { name: 'archiveGuard.resolveButtonArchive' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/applications/a1', { phase_key: 'afgewezen_x' }))
  })

  it('falls back to the seed rejected slug when no funnelTypes prop is passed', async () => {
    renderModal(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'archiveGuard.resolveButtonArchive' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/applications/a1', { phase_key: 'rejected' }))
  })
})
