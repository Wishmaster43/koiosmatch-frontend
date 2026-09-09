/**
 * RoleDetail — the permissions DRAFT + Save flow (Danny 09-09, verbatim: "de
 * toggle reageert traag ... gewoon een opslaan knop komt zodat het wel snel
 * werkt"). Covers: a toggle flips the draft with no request, the Save button
 * is disabled while clean and sends exactly one PUT with the full set on
 * click, dirtiness is reported to SettingsDirtyContext, and the Back button
 * asks for confirmation when the draft is dirty.
 */
import type { ReactNode, ReactElement } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { RoleDetail } from './RoleDetail'
import { SettingsDirtyContext } from '../lib/settingsDirty'
import type { Role, PermissionsByGroup } from './rolesTypes'

// SettingsDirtyContext lives in a plain .js file (createContext(null)) — cast the
// Provider so the test can supply the real `{ report }` shape RoleDetail reads.
const DirtyProvider = SettingsDirtyContext.Provider as unknown as (
  props: { value: { report: (dirty: boolean) => void }; children: ReactNode }
) => ReactElement

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
// Network-backed hook used by the branch-template card — stubbed so RoleDetail
// can render without a real QueryClientProvider (mirrors RolesSettings.test.tsx).
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [] }))

afterEach(() => vi.clearAllMocks())

const ROLE: Role = { id: 'r1', name: 'recruiter', color: 'var(--color-primary)', icon: 'shield', users_count: 0,
  permissions: [{ name: 'candidates.view' }] }
const PERMISSIONS: PermissionsByGroup = {
  candidates: [{ name: 'candidates.view' }, { name: 'candidates.create' }],
}

// Real GET the branch-template card issues on mount — resolved empty so the card
// settles without an error state; irrelevant to the assertions below.
const armBranches = () => { vi.mocked(api.get).mockResolvedValue({ data: [] }) }

describe('RoleDetail — permissions draft (no request per toggle) + one Save PUT', () => {
  it('toggling a permission flips it locally with NO request; Save then PUTs exactly one full set', async () => {
    armBranches()
    vi.mocked(api.put).mockResolvedValue({ data: { ...ROLE, permissions: [{ name: 'candidates.view' }, { name: 'candidates.create' }] } })
    const user = userEvent.setup()
    render(<RoleDetail role={ROLE} permissions={PERMISSIONS} iconOptions={['shield']} onBack={vi.fn()} onUpdate={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: `${st('roles.groups.candidates')} — ${st('roles.matrixAllowed', { active: 1, total: 2, defaultValue: '1/2 toegestaan' })}` }))
    const toggle = await screen.findByTitle('candidates.create')
    await user.click(toggle)
    expect(api.put).not.toHaveBeenCalled()

    const save = screen.getByRole('button', { name: st('common.save') })
    expect(save).toBeEnabled()
    await user.click(save)

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
    expect(api.put).toHaveBeenCalledWith('/roles/r1/permissions', { permissions: ['candidates.view', 'candidates.create'] })
  })

  it('Save is disabled while the draft has not changed', async () => {
    armBranches()
    render(<RoleDetail role={ROLE} permissions={PERMISSIONS} iconOptions={['shield']} onBack={vi.fn()} onUpdate={vi.fn()} />)
    expect(await screen.findByRole('button', { name: st('common.save') })).toBeDisabled()
  })

  it('reports dirtiness to SettingsDirtyContext and clears it once saved', async () => {
    armBranches()
    vi.mocked(api.put).mockResolvedValue({ data: { ...ROLE, permissions: [{ name: 'candidates.view' }, { name: 'candidates.create' }] } })
    const report = vi.fn()
    const user = userEvent.setup()
    render(
      <DirtyProvider value={{ report }}>
        <RoleDetail role={ROLE} permissions={PERMISSIONS} iconOptions={['shield']} onBack={vi.fn()} onUpdate={vi.fn()} />
      </DirtyProvider>,
    )
    expect(report).toHaveBeenCalledWith(false)
    report.mockClear()

    await user.click(screen.getByRole('button', { name: `${st('roles.groups.candidates')} — ${st('roles.matrixAllowed', { active: 1, total: 2, defaultValue: '1/2 toegestaan' })}` }))
    await user.click(await screen.findByTitle('candidates.create'))
    await waitFor(() => expect(report).toHaveBeenCalledWith(true))

    await user.click(screen.getByRole('button', { name: st('common.save') }))
    await waitFor(() => expect(report).toHaveBeenLastCalledWith(false))
  })

  it('clicking Back with a dirty draft asks for confirmation before leaving', async () => {
    armBranches()
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(<RoleDetail role={ROLE} permissions={PERMISSIONS} iconOptions={['shield']} onBack={onBack} onUpdate={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: `${st('roles.groups.candidates')} — ${st('roles.matrixAllowed', { active: 1, total: 2, defaultValue: '1/2 toegestaan' })}` }))
    await user.click(await screen.findByTitle('candidates.create'))

    await user.click(screen.getByRole('button', { name: st('common.back') }))
    expect(onBack).not.toHaveBeenCalled()
    expect(screen.getByText(st('common.unsavedConfirm'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: i18n.t('confirm', { ns: 'common' }) }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('clicking Back with a clean draft leaves immediately, no confirmation', async () => {
    armBranches()
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(<RoleDetail role={ROLE} permissions={PERMISSIONS} iconOptions={['shield']} onBack={onBack} onUpdate={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: st('common.back') }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
