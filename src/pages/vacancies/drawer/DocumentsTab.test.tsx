/**
 * DocumentsTab (vacancy) — DOCTYPE-VACANCY-1 (audit finding, 05-08): uploads used
 * to always POST an empty `type`, so a vacancy document could never be categorised.
 * §13: assert the actual upload() REQUEST (file/type/name/objectUrl), not just that
 * picking a file "did something".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import DocumentsTab from './DocumentsTab'
import { useEntityDocuments } from '@/hooks/useEntityDocuments'
import type { VacancyDetail } from '@/types/vacancy'

// Resolve the active locale's own copy so assertions never guess/hardcode a string.
const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'vacancies', ...opts })

vi.mock('@/hooks/useEntityDocuments', () => ({
  useEntityDocuments: vi.fn(() => ({ docs: [], upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })),
}))
// A fixed 2-type tenant lookup, entity-scoped 'vacancy' — the real hook's fetch/
// cache plumbing is irrelevant here, only that DocumentsTab reads it and passes
// the picked value through to upload().
vi.mock('@/lib/useDocumentTypes', () => ({
  useDocumentTypes: vi.fn(() => ({
    types: [
      { value: 'Contract', label: 'Contract', color: '#059669' },
      { value: 'CV', label: 'CV', color: '#4F46E5' },
    ],
    labelOf: (v?: string) => v ?? '',
    colorOf: () => '#4F46E5',
  })),
}))

const vacancy = { id: 'v1', title: 'Verpleegkundige IC' } as VacancyDetail
const file = new File(['content'], 'contract.pdf', { type: 'application/pdf' })
const getFileInput = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement
// Two buttons share the "Toevoegen" label with one file queued: the always-present
// header "+ Toevoegen" trigger, and the pending card's own confirm — the LATTER
// (last in DOM order) is the one that actually calls upload().
const clickConfirm = () => {
  const buttons = screen.getAllByRole('button', { name: t('common:add') })
  return userEvent.click(buttons[buttons.length - 1])
}

// Hoisted mock refs (reassigned per test in beforeEach) so individual tests can vary
// createObjectURL's return value across calls (§13: assert the actual revoke calls).
let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>

describe('DocumentsTab (vacancy) · document type', () => {
  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:contract.pdf')
    revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
  })
  afterEach(() => vi.clearAllMocks())

  it('reads the vacancy-scoped document-type lookup', async () => {
    const { useDocumentTypes } = await import('@/lib/useDocumentTypes')
    render(<DocumentsTab vacancy={vacancy} />)
    expect(vi.mocked(useDocumentTypes)).toHaveBeenCalledWith('vacancy')
  })

  it('defaults the staged file to the lookup\'s first type and confirms it into upload()', async () => {
    const upload = vi.fn()
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], upload, rename: vi.fn(), remove: vi.fn() })
    const { container } = render(<DocumentsTab vacancy={vacancy} />)
    fireEvent.change(getFileInput(container), { target: { files: [file] } })

    // The pending card's own chip picker shows a soft-tint selection for the
    // lookup's first type before the user changes anything.
    const contractChip = screen.getByRole('button', { name: 'Contract' })
    expect(contractChip).toHaveStyle({ fontWeight: '600' })

    await clickConfirm()
    expect(upload).toHaveBeenCalledWith(file, 'Contract', 'contract.pdf', 'blob:contract.pdf')
  })

  it('lets the user pick a different type before confirming the upload', async () => {
    const upload = vi.fn()
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], upload, rename: vi.fn(), remove: vi.fn() })
    const { container } = render(<DocumentsTab vacancy={vacancy} />)
    fireEvent.change(getFileInput(container), { target: { files: [file] } })

    await userEvent.click(screen.getByRole('button', { name: 'CV' }))
    await clickConfirm()
    expect(upload).toHaveBeenCalledWith(file, 'CV', 'contract.pdf', 'blob:contract.pdf')
  })

  it('cancelling the staged file never calls upload()', async () => {
    const upload = vi.fn()
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], upload, rename: vi.fn(), remove: vi.fn() })
    const { container } = render(<DocumentsTab vacancy={vacancy} />)
    fireEvent.change(getFileInput(container), { target: { files: [file] } })

    await userEvent.click(screen.getByRole('button', { name: t('common:cancel') }))
    expect(upload).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Contract' })).not.toBeInTheDocument()
  })

  it('renders an existing document\'s type as a soft-tint chip', () => {
    vi.mocked(useEntityDocuments).mockReturnValue({
      docs: [{ id: 'd1', name: 'contract.pdf', type: 'Contract', download_url: 'https://x/contract.pdf' }],
      upload: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    })
    render(<DocumentsTab vacancy={vacancy} />)
    expect(screen.getByText('Contract')).toBeInTheDocument()
  })

  // Blob-URL leak (heraudit-2, point 3): a staged-but-unconfirmed preview must be
  // revoked when replaced by a second pick — the old preview used to stay alive forever.
  it('revokes the previous staged preview when a second file is picked before confirming', async () => {
    createObjectURL.mockReturnValueOnce('blob:first.pdf').mockReturnValueOnce('blob:second.pdf')
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    const { container } = render(<DocumentsTab vacancy={vacancy} />)
    const secondFile = new File(['other'], 'second.pdf', { type: 'application/pdf' })

    fireEvent.change(getFileInput(container), { target: { files: [file] } })
    expect(revokeObjectURL).not.toHaveBeenCalled()

    fireEvent.change(getFileInput(container), { target: { files: [secondFile] } })
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first.pdf')
    expect(revokeObjectURL).not.toHaveBeenCalledWith('blob:second.pdf')
    expect(screen.getByText('second.pdf')).toBeInTheDocument()
  })

  // Blob-URL leak (heraudit-2, point 3): closing the drawer (unmount) with a staged,
  // unconfirmed file must revoke its preview too — not just the explicit "cancel" path.
  it('revokes a still-staged preview on unmount', () => {
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    const { container, unmount } = render(<DocumentsTab vacancy={vacancy} />)
    fireEvent.change(getFileInput(container), { target: { files: [file] } })

    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:contract.pdf')
  })

  // Confirming the upload hands the object URL's lifecycle to useEntityDocuments
  // (which revokes it once the server doc replaces the optimistic row) — the modal
  // itself must NOT also revoke it, or the still-showing optimistic preview would break.
  it('does not revoke the object URL itself on confirm (ownership passes to upload())', async () => {
    const upload = vi.fn()
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], upload, rename: vi.fn(), remove: vi.fn() })
    const { container } = render(<DocumentsTab vacancy={vacancy} />)
    fireEvent.change(getFileInput(container), { target: { files: [file] } })

    await clickConfirm()
    expect(upload).toHaveBeenCalledWith(file, 'Contract', 'contract.pdf', 'blob:contract.pdf')
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })
})
