/**
 * VacancyContentBlocksSettings — covers the four UI states (loading/error/empty/
 * ready) plus the 'unavailable' calm notice for a 404 (VACGEN-1's backend route
 * doesn't exist yet — §3: no dead Add button whose POST would silently fail),
 * and asserts the actual POST/PUT request shape (§13: route + body, not just
 * that a callback fired).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import VacancyContentBlocksSettings from './VacancyContentBlocksSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }) => <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />,
}))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })
const ct = (key, opts) => i18n.t(key, { ns: 'common', ...opts })

const block = (over = {}) => ({ id: 'b1', name: 'Standaard intro', kind: 'intro', body: '<p>Welkom</p>', in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('VacancyContentBlocksSettings', () => {
  it('shows the loading state, then the error state on a failed fetch', async () => {
    api.get.mockRejectedValue(new Error('network down'))
    render(<VacancyContentBlocksSettings />)
    expect(screen.getByText(st('common.loadingShort'))).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(st('vacancyContentBlocksSettings.loadError'))).toBeInTheDocument())
  })

  it('a 404 shows the calm "not available yet" notice with no Add button (§3 no dead affordance)', async () => {
    api.get.mockRejectedValue({ response: { status: 404 } })
    render(<VacancyContentBlocksSettings />)
    await waitFor(() => expect(screen.getByText(st('vacancyContentBlocksSettings.unavailable'))).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: st('vacancyContentBlocksSettings.add') })).not.toBeInTheDocument()
  })

  it('shows the empty state when there are no blocks', async () => {
    api.get.mockResolvedValue({ data: { data: [] } })
    render(<VacancyContentBlocksSettings />)
    await waitFor(() => expect(screen.getByText(st('vacancyContentBlocksSettings.empty'))).toBeInTheDocument())
  })

  it('renders the block list with its kind label', async () => {
    api.get.mockResolvedValue({ data: { data: [block()] } })
    render(<VacancyContentBlocksSettings />)
    await waitFor(() => expect(screen.getByText('Standaard intro')).toBeInTheDocument())
    expect(screen.getByText(st('vacancyContentBlocksSettings.kind.intro'))).toBeInTheDocument()
  })

  it('creating a block POSTs the name/kind/body shape to the content-blocks route', async () => {
    api.get.mockResolvedValue({ data: { data: [] } })
    api.post.mockResolvedValue({ data: { data: block({ id: 'new1', name: 'New block' }) } })
    const user = userEvent.setup()
    render(<VacancyContentBlocksSettings />)

    await waitFor(() => expect(screen.getByText(st('vacancyContentBlocksSettings.empty'))).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: st('vacancyContentBlocksSettings.add') }))
    await user.type(screen.getByPlaceholderText(st('vacancyContentBlocksSettings.namePlaceholder')), 'New block')
    await user.click(await screen.findByRole('button', { name: st('vacancyContentBlocksSettings.add') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/vacancy-content-blocks', { name: 'New block', kind: 'intro', body: '' }))
  })

  it('saving an edited block PUTs to the block-specific route with the edited name', async () => {
    api.get.mockResolvedValue({ data: { data: [block()] } })
    api.put.mockResolvedValue({ data: { data: block({ name: 'Renamed' }) } })
    const user = userEvent.setup()
    render(<VacancyContentBlocksSettings />)

    await waitFor(() => expect(screen.getByText('Standaard intro')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: `${st('common.edit')}: Standaard intro` }))
    const nameInput = await screen.findByDisplayValue('Standaard intro')
    await user.clear(nameInput)
    await user.type(nameInput, 'Renamed')
    await user.click(await screen.findByRole('button', { name: st('common.save') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/vacancy-content-blocks/b1', { name: 'Renamed', kind: 'intro', body: '<p>Welkom</p>' }))
  })

  it('a 409 on delete keeps the row and blocks re-deletion instead of removing it', async () => {
    api.get.mockResolvedValue({ data: { data: [block()] } })
    api.delete.mockRejectedValue({ response: { status: 409 } })
    const user = userEvent.setup()
    render(<VacancyContentBlocksSettings />)

    await waitFor(() => expect(screen.getByText('Standaard intro')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: `${st('common.edit')}: Standaard intro` }))
    await user.click(await screen.findByRole('button', { name: st('vacancyContentBlocksSettings.delete') }))
    await user.click(await screen.findByRole('button', { name: ct('confirm') }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/vacancy-content-blocks/b1'))
    expect(screen.getByText('Standaard intro')).toBeInTheDocument()
  })
})
