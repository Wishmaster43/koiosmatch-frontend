/** ExternalIdCell: read-only face, trimmed save, blank unlinks, Enter/Escape, draft kept on failure. */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ExternalIdCell from './ExternalIdCell'

const ct = (key: string) => i18n.t(key, { ns: 'common' })
const LABEL = 'HF id'

describe('ExternalIdCell', () => {
  it('renders read-only text without an input when canEdit is false', () => {
    render(<ExternalIdCell value="abc" onSave={vi.fn()} canEdit={false} label={LABEL} copyLabel="Kantoor · HF" statusLabel="Gekoppeld" />)
    expect(screen.getByText('abc')).toBeInTheDocument()
    expect(screen.queryByLabelText(LABEL)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kantoor · HF' })).toBeInTheDocument()
  })

  it('shows a dash when read-only and unlinked', () => {
    render(<ExternalIdCell value={null} onSave={vi.fn()} canEdit={false} label={LABEL} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('saves the trimmed value', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ExternalIdCell value={null} onSave={onSave} canEdit label={LABEL} />)
    await user.type(screen.getByLabelText(LABEL), '  guid-1  ')
    await user.click(screen.getByRole('button', { name: `${ct('save')} ${LABEL}` }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('guid-1'))
  })

  it('maps a blank value to null (unlink)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ExternalIdCell value="old" onSave={onSave} canEdit label={LABEL} />)
    await user.clear(screen.getByLabelText(LABEL))
    await user.click(screen.getByRole('button', { name: `${ct('save')} ${LABEL}` }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null))
  })

  it('Enter saves and Escape reverts the draft', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ExternalIdCell value="old" onSave={onSave} canEdit label={LABEL} />)
    const input = screen.getByLabelText(LABEL)
    await user.type(input, 'X{Escape}')
    expect(input).toHaveValue('old')
    await user.type(input, 'Y{Enter}')
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('oldY'))
  })

  it('keeps the draft when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('nope'))
    const user = userEvent.setup()
    render(<ExternalIdCell value={null} onSave={onSave} canEdit label={LABEL} />)
    await user.type(screen.getByLabelText(LABEL), 'keep')
    await user.click(screen.getByRole('button', { name: `${ct('save')} ${LABEL}` }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(screen.getByLabelText(LABEL)).toHaveValue('keep')
  })

  it('shows the translated status and the server error as hover title', () => {
    const st = i18n.t('settings:locations.linkStatus.failed')
    render(<ExternalIdCell value="abc" onSave={vi.fn()} canEdit={false} label={LABEL} statusLabel={st} failed error="boom" />)
    expect(screen.getByText('abc').closest('span')).toHaveAttribute('title', `${st}: boom`)
  })

  it('renders a spinner instead of the value while loading', () => {
    render(<ExternalIdCell value={null} onSave={vi.fn()} canEdit label={LABEL} loading />)
    expect(screen.queryByLabelText(LABEL)).not.toBeInTheDocument()
  })
})
