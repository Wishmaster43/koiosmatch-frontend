/**
 * TaskStatusSettings — round-4 audit finding #4: `is_done` is backend-writable
 * (TaskStatusController.php:45,61) and FE-consumed (TaskLookupsContext.doneStatusValues)
 * but the Settings screen never wired it. §13: assert the PUT request body, not
 * merely that a click happened.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { TaskStatusSettings } from './TaskSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// Resolve the active locale's own copy so assertions never hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: a fixture row's tenant-picked colour, not a style rule.
const status = (over = {}) => ({ id: 'ts1', name: 'Afgerond', color: '#79B58E', is_done: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('TaskStatusSettings', () => {
  it('shows the is_done badge only for a row already flagged completed', async () => {
    api.get.mockResolvedValue({ data: [status({ is_done: true })] })
    render(<TaskStatusSettings />)

    await screen.findByText('Afgerond')
    expect(screen.getByText(st('tasks.flagDone'))).toBeInTheDocument()
  })

  it('PUTs is_done:true to /task-statuses/{id} when the flag is toggled in the edit modal', async () => {
    api.get.mockResolvedValue({ data: [status()] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<TaskStatusSettings />)

    await screen.findByText('Afgerond')
    await user.click(screen.getByRole('button', { name: st('statusList.edit') }))
    await user.click(screen.getByRole('switch'))
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/task-statuses/ts1',
      expect.objectContaining({ is_done: true })))
  })
})
