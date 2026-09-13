/**
 * SkillLevelSettings — LOOKUP-ICONS-FE-2 fix (13-09): skill_levels gained an icon
 * column/fillable, but NOT color (SkillLevel::$fillable has no `color`) — withColor
 * stays false; only the icon mark + PATCH is guarded here.
 */
import { it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import apiClient from '@/lib/api'
import { SkillLevelSettings } from './SkillLevelSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// The mocked axios instance, typed as its four mocked methods (established pattern).
const api = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

it('renders the icon-only mark (no colour column) and picking an icon PUTs {icon}', async () => {
  api.get.mockResolvedValue({ data: [{ id: 'sl1', name: 'Basis', icon: null }] })
  api.put.mockResolvedValue({ data: {} })
  const user = userEvent.setup()
  render(<SkillLevelSettings />)

  await screen.findByText('Basis')
  const trigger = screen.getByRole('button', { name: st('statusList.valueMark', { label: 'Basis' }) })
  await user.click(trigger)
  const iconCell = (await screen.findAllByRole('menuitem'))[0]
  await user.click(iconCell)

  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/skill-levels/sl1', expect.objectContaining({ icon: expect.any(String) })))
})
