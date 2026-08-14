/**
 * DeletionPreviewModal (TRASH-OVERAL-2) — the shared trash dialog: blocker rows
 * translate their stable type tokens (server label only as fallback), the
 * transfer picker is searchable + clearable (pick → clear → onConfirm(null)
 * regression), and the confirm button is honest (disabled + notice while
 * blocked or !can_mark, never a dead button without explanation).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import DeletionPreviewModal from './DeletionPreviewModal'
import type { DeletionPreview } from '@/types/deletion'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

const PREVIEW: DeletionPreview = {
  blocking: [],
  transferable: null,
  can_mark: true,
  lifecycle: 'archived',
}

const USERS = [
  { value: 'u-1', label: 'Anna de Vries' },
  { value: 'u-2', label: 'Bram Jansen' },
]

// Shared render with sensible defaults; individual tests override what they probe.
function renderModal(over: Partial<Parameters<typeof DeletionPreviewModal>[0]> = {}) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <DeletionPreviewModal open onClose={onClose} entityLabel="Jansen B.V." preview={PREVIEW}
      loading={false} error={false} users={USERS} onConfirm={onConfirm} busy={false} blocked={false}
      {...over} />,
  )
  return { onConfirm, onClose }
}

const confirmButton = () => screen.getByRole('button', { name: t('trash.modal.confirm') as string })

describe('DeletionPreviewModal — blockers', () => {
  it('renders the blocking list via the stable type tokens with counts; unknown tokens fall back to the server label', () => {
    renderModal({
      preview: {
        ...PREVIEW,
        can_mark: false,
        blocking: [
          { type: 'open_tasks', label: 'server-NL-tekst', count: 3 },
          { type: 'some_future_token', label: 'Serverlabel', count: 1 },
        ],
      },
    })
    // Known token translates (nl locale), the server's NL label is ignored for it.
    expect(screen.getByText('Open taken')).toBeInTheDocument()
    expect(screen.queryByText('server-NL-tekst')).not.toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    // Unknown token: honest fallback to the server-provided label.
    expect(screen.getByText('Serverlabel')).toBeInTheDocument()
  })

  it('disables confirm when can_mark is false', () => {
    renderModal({ preview: { ...PREVIEW, can_mark: false } })
    expect(confirmButton()).toBeDisabled()
  })

  it('shows the honest blocked notice and keeps confirm disabled after a 409', () => {
    const { onConfirm } = renderModal({
      blocked: true,
      preview: { ...PREVIEW, can_mark: false, blocking: [{ type: 'matches', label: 'Matches', count: 2 }] },
    })
    expect(screen.getByText(t('trash.modal.blockedIntro') as string)).toBeInTheDocument()
    const btn = confirmButton()
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

describe('DeletionPreviewModal — transfer picker', () => {
  const TRANSFERABLE: DeletionPreview = {
    ...PREVIEW,
    transferable: { attribute: 'owner_id', current_owner_id: 'u-1' },
  }

  it('shows a searchable owner picker when transferable is set', () => {
    renderModal({ preview: TRANSFERABLE })
    expect(screen.getByText(t('trash.modal.transferLabel') as string)).toBeInTheDocument()
    // Open the picker: the search input proves it is the searchable house picker.
    fireEvent.click(screen.getByText(t('trash.modal.transferPlaceholder') as string))
    expect(screen.getByRole('textbox', { name: t('trash.modal.transferPlaceholder') as string })).toBeInTheDocument()
    expect(screen.getByText('Anna de Vries')).toBeInTheDocument()
  })

  it('confirms with the picked owner id', () => {
    const { onConfirm } = renderModal({ preview: TRANSFERABLE })
    fireEvent.click(screen.getByText(t('trash.modal.transferPlaceholder') as string))
    fireEvent.click(screen.getByText('Anna de Vries'))
    fireEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledWith('u-1')
  })

  it('pick → clear → confirm sends null (optional field stays clearable)', () => {
    const { onConfirm } = renderModal({ preview: TRANSFERABLE })
    fireEvent.click(screen.getByText(t('trash.modal.transferPlaceholder') as string))
    fireEvent.click(screen.getByText('Anna de Vries'))
    // Clear the optional pick via the picker's X (accessible name woven from the label).
    fireEvent.click(screen.getByTitle(t('clearField', { field: t('trash.modal.transferLabel') }) as string))
    fireEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledWith(null)
  })
})

describe('DeletionPreviewModal — states & grace wording', () => {
  it('busy disables confirm', () => {
    renderModal({ busy: true })
    expect(confirmButton()).toBeDisabled()
  })

  it('renders loading and error states instead of a blank panel', () => {
    renderModal({ loading: true, preview: null })
    expect(screen.getByText(t('loading') as string)).toBeInTheDocument()

    document.body.innerHTML = ''
    renderModal({ error: true, preview: null })
    expect(screen.getByRole('alert')).toHaveTextContent(t('errorGeneric') as string)
    expect(confirmButton()).toBeDisabled()
  })

  it('shows the projected erase date from the grace window, or neutral wording without one', () => {
    renderModal({ graceDays: 10 })
    const date = new Date(Date.now() + 10 * 86400000)
    const dd = String(date.getDate()).padStart(2, '0')
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    // DD-MM-YYYY via the house formatter — never ISO, never a slash locale.
    expect(screen.getByText(t('trash.eraseAround', { date: `${dd}-${mm}-${date.getFullYear()}` }) as string)).toBeInTheDocument()

    document.body.innerHTML = ''
    renderModal({ graceDays: null })
    expect(screen.getByText(t('trash.eraseAutomatic') as string)).toBeInTheDocument()
  })
})
