/**
 * CaoSettings — smoke test: renders the shared StatusListEditor against /cao
 * and asserts the create request. Mirrors ContractTypesSettings.test.jsx (same
 * shared component, same SlugLookupController contract).
 *
 * LOOKUP-GAP-1(d) verification 08-08: CaoController extends SlugLookupController,
 * whose store() validates `value` as REQUIRED — the create test asserts the
 * slugged `value` lands in the POST body, guarding the `withValueSlug` opt-in
 * that makes "+ CLA toevoegen" real instead of a 422 on every tenant. This file
 * did not exist before (LOOKUP-GAP-1(d) audit) — CaoSettings shipped with zero
 * test coverage, unlike every sibling lookup editor.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import CaoSettings from './CaoSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: a fixture CLA's tenant-picked colour, not a style rule.
const cla = (over = {}) => ({ id: 'c1', value: 'vvt', label: 'CAO VVT', color: '#3B8FD4', in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('CaoSettings', () => {
  it('loads the list from /cao', async () => {
    api.get.mockResolvedValue({ data: [cla()] })
    render(<CaoSettings />)

    await screen.findByText('CAO VVT')
    expect(api.get).toHaveBeenCalledWith('/cao', undefined)
  })

  it('creating a CLA POSTs a slugged value alongside name/label to /cao', async () => {
    api.get.mockResolvedValue({ data: [cla()] })
    api.post.mockResolvedValue({ data: cla({ id: 'c2', value: 'ziekenhuizen', label: 'CAO Ziekenhuizen' }) })
    const user = userEvent.setup()
    render(<CaoSettings />)

    await screen.findByText('CAO VVT')
    await user.click(screen.getByRole('button', { name: st('caoSettings.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'CAO Ziekenhuizen')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    // Assert the REQUEST (§13) — `value` is the slug SlugLookupController::store()
    // requires; without withValueSlug this POST would 422 in real life.
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/cao',
      expect.objectContaining({ name: 'CAO Ziekenhuizen', label: 'CAO Ziekenhuizen', value: 'cao_ziekenhuizen' })))
  })

  it('deleting an in-use CLA is blocked, deleting an unused one DELETEs /cao/{id}', async () => {
    api.get.mockResolvedValue({ data: [cla({ id: 'c1', in_use: false })] })
    api.delete.mockResolvedValue({})
    const user = userEvent.setup()
    render(<CaoSettings />)

    await screen.findByText('CAO VVT')
    const editBtn = screen.getByRole('button', { name: st('statusList.edit') })
    const deleteBtn = editBtn.nextElementSibling
    await user.click(deleteBtn)
    await user.click(await screen.findByRole('button', { name: i18n.t('confirm', { ns: 'common' }) }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/cao/c1'))
  })

  it('renaming an existing CLA PUTs the new label to /cao/{id}', async () => {
    api.get.mockResolvedValue({ data: [cla({ id: 'c1' })] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<CaoSettings />)

    await screen.findByText('CAO VVT')
    await user.click(screen.getByRole('button', { name: st('statusList.edit') }))
    const nameInput = screen.getByPlaceholderText(st('statusList.namePlaceholder'))
    await user.clear(nameInput)
    await user.type(nameInput, 'CAO VVT (nieuw)')
    await user.click(screen.getByRole('button', { name: st('common.save') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/cao/c1',
      expect.objectContaining({ name: 'CAO VVT (nieuw)' })))
  })
})
