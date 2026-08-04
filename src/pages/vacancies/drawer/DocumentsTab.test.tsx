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

describe('DocumentsTab (vacancy) · document type', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:contract.pdf'), revokeObjectURL: vi.fn() })
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
})
