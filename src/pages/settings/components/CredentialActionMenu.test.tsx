/**
 * CredentialActionMenu.test — the shared regenerate/activate-or-deactivate/delete
 * overflow menu (ApiKeyDetail/WebhookDetail): the toggle label flips with status,
 * and each item calls its own callback.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CredentialActionMenu } from './CredentialActionMenu'

function labels() {
  return {
    actionLabel: 'Actions', regenerateLabel: 'Regenerate',
    activateLabel: 'Activate', deactivateLabel: 'Deactivate', deleteLabel: 'Delete',
  }
}

describe('CredentialActionMenu', () => {
  it('shows Deactivate for an active credential and calls onToggleStatus', () => {
    const onToggleStatus = vi.fn()
    render(<CredentialActionMenu {...labels()} status="active"
      onRegenerate={vi.fn()} onToggleStatus={onToggleStatus} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    fireEvent.click(screen.getByText('Deactivate'))
    expect(onToggleStatus).toHaveBeenCalledTimes(1)
  })

  it('shows Activate for an inactive credential', () => {
    render(<CredentialActionMenu {...labels()} status="inactive"
      onRegenerate={vi.fn()} onToggleStatus={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    expect(screen.getByText('Activate')).toBeInTheDocument()
    expect(screen.queryByText('Deactivate')).not.toBeInTheDocument()
  })

  it('calls onRegenerate and onDelete from their own items', () => {
    const onRegenerate = vi.fn(); const onDelete = vi.fn()
    render(<CredentialActionMenu {...labels()} status="active"
      onRegenerate={onRegenerate} onToggleStatus={vi.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    fireEvent.click(screen.getByText('Regenerate'))
    expect(onRegenerate).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    fireEvent.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
