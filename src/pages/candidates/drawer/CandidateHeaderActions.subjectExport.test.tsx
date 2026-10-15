import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CandidateHeaderActions } from './CandidateHeaderBits'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { Candidate } from '@/types/candidate'

// ONIX K-001 (Danny 8a = A; BE lane D f0855053): the right-of-access export on the candidate
// dossier — admin-only (the drawer passes canSubjectExport from privacy.subject-export), one
// POST with the exact body, the signed download URL opened as a real navigation.
import '@/i18n'
vi.mock('@/lib/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/lib/useCvSettings', () => ({ useCvSettings: () => ({ settings: {} }) }))

const c = { id: 'cand-1', name: 'Sem Blom' } as unknown as Candidate
const base = { c, isEntryPhase: false, converting: false, onConvert: vi.fn(), headerEditing: false, onStartEdit: vi.fn(), onSaveEdit: vi.fn(), onCancelEdit: vi.fn() }

describe('CandidateHeaderActions — right-of-access export', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is absent without the permission', () => {
    render(<CandidateHeaderActions {...base} />)
    expect(screen.queryByRole('button', { name: 'Exporteer persoonsgegevens (inzagerecht)' })).toBeNull()
  })

  it('POSTs the exact subject-access request and opens the signed download', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { download_url: 'https://api.test/exports/signed/abc', expires: '2026-10-16T01:00:00Z' } } })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    render(<CandidateHeaderActions {...base} canSubjectExport />)
    await user.click(screen.getByRole('button', { name: 'Exporteer persoonsgegevens (inzagerecht)' }))
    expect(api.post).toHaveBeenCalledWith('/exports/subject-access', { subject_type: 'candidate', subject_id: 'cand-1' })
    expect(open).toHaveBeenCalledWith('https://api.test/exports/signed/abc', '_blank', 'noopener,noreferrer')
    expect(notifySuccess).toHaveBeenCalledWith('Export gestart: de download opent in een nieuw tabblad.')
    open.mockRestore()
  })

  it('reports a refusal with the server text, never silently', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 403, data: { message: 'Geen recht op inzage-export.' } } })
    const user = userEvent.setup()
    render(<CandidateHeaderActions {...base} canSubjectExport />)
    await user.click(screen.getByRole('button', { name: 'Exporteer persoonsgegevens (inzagerecht)' }))
    expect(notifyError).toHaveBeenCalledWith('Geen recht op inzage-export.')
  })
})
