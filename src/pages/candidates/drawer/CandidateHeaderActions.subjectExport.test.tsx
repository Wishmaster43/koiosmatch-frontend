import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CandidateHeaderActions } from './CandidateHeaderBits'
import { renderCvBlob } from '../cv/renderCvBlob'
import api from '@/lib/api'
import { notify, notifyError } from '@/lib/notify'
import type { Candidate } from '@/types/candidate'

// ONIX K-001 (Danny 8a = A; BE lane D f0855053): the right-of-access export on the candidate
// dossier — admin-only (the drawer passes canSubjectExport from privacy.subject-export), one
// POST with the exact body, the signed download URL opened as a real navigation.
import i18n from '@/i18n'
vi.mock('@/lib/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/lib/useCvSettings', () => ({ useCvSettings: () => ({ settings: {} }) }))
vi.mock('../cv/renderCvBlob', () => ({ renderCvBlob: vi.fn().mockResolvedValue(new Blob(['x'])) }))

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
    const assign = vi.fn()
    const realLocation = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, assign } })
    const user = userEvent.setup()
    render(<CandidateHeaderActions {...base} canSubjectExport />)
    await user.click(screen.getByRole('button', { name: 'Exporteer persoonsgegevens (inzagerecht)' }))
    expect(api.post).toHaveBeenCalledWith('/exports/subject-access', { subject_type: 'candidate', subject_id: 'cand-1' })
    // Same-tab navigation (popup-blocker safe); window.open is never used after the await.
    expect(assign).toHaveBeenCalledWith('https://api.test/exports/signed/abc')
    expect(open).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('success', i18n.t('drawer.subjectExportStarted', { ns: 'candidates' }), { deepLink: 'https://api.test/exports/signed/abc' })
    open.mockRestore()
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
  })

  it('reports a refusal with the server text, never silently', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 403, data: { message: 'Geen recht op inzage-export.' } } })
    const user = userEvent.setup()
    render(<CandidateHeaderActions {...base} canSubjectExport />)
    await user.click(screen.getByRole('button', { name: 'Exporteer persoonsgegevens (inzagerecht)' }))
    expect(notifyError).toHaveBeenCalledWith('Geen recht op inzage-export.')
  })

  it('treats a 201 without download_url as an error, never a success toast', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { expires: '2026-10-16T01:00:00Z' } } })
    const user = userEvent.setup()
    render(<CandidateHeaderActions {...base} canSubjectExport />)
    await user.click(screen.getByRole('button', { name: 'Exporteer persoonsgegevens (inzagerecht)' }))
    expect(notifyError).toHaveBeenCalledWith('De export van persoonsgegevens is mislukt.')
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('CandidateHeaderActions — CV download', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the PDF through the lazy renderCvBlob module and downloads it under the candidate name', async () => {
    const createObjectURL = vi.fn(() => 'blob:cv')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const downloads: string[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download) })
    const user = userEvent.setup()
    render(<CandidateHeaderActions {...base} />)
    await user.click(screen.getByRole('button', { name: i18n.t('drawer.downloadCv', { ns: 'candidates' }) }))
    await vi.waitFor(() => expect(click).toHaveBeenCalled())
    expect(renderCvBlob).toHaveBeenCalledWith(expect.objectContaining({ c: expect.objectContaining({ id: 'cand-1' }) }))
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(downloads).toEqual(['CV - Sem Blom.pdf'])
    click.mockRestore()
  })
})
