/**
 * MatchContractSendAction — hidden without matches.update, without the HelloFlex
 * connector (app OR hf module, CONNECTOR-VS-REPORTING-1), or while a send is in
 * flight; shown otherwise (HF-CONTRACT-SEND-1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import MatchContractSendAction from './MatchContractSendAction'
import type { MatchRow } from '@/types/match'

const mockHasPermission = vi.fn()
const mockIsAppEnabled = vi.fn()
const mockHasModule = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: mockHasPermission, hasModule: mockHasModule }) }))
vi.mock('@/context/AppsContext', () => ({ useApps: () => ({ isAppEnabled: mockIsAppEnabled }) }))
vi.mock('./MatchContractSendModal', () => ({ default: () => null }))

const label = () => i18n.t('drawer.contractSend.open', { ns: 'matches' })
const renderAction = (m: Partial<MatchRow> = {}) =>
  render(<I18nextProvider i18n={i18n}><MatchContractSendAction match={{ id: 'm1', ...m } as MatchRow} /></I18nextProvider>)

describe('MatchContractSendAction', () => {
  beforeEach(() => { vi.clearAllMocks(); i18n.changeLanguage('en'); mockHasPermission.mockReturnValue(true); mockIsAppEnabled.mockReturnValue(true); mockHasModule.mockReturnValue(true) })

  it('shows the button with permission and the HelloFlex app', () => {
    renderAction()
    expect(screen.getByRole('button', { name: label() })).toBeInTheDocument()
    expect(mockIsAppEnabled).toHaveBeenCalledWith('hf')
  })
  it('is hidden without matches.update', () => {
    mockHasPermission.mockReturnValue(false)
    renderAction()
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('stays visible on the HelloFlex app alone (hf module off: connector, not reporting)', () => {
    mockHasModule.mockReturnValue(false)
    renderAction()
    expect(screen.getByRole('button', { name: label() })).toBeInTheDocument()
  })
  it('stays visible on the hf module alone (a legacy package without the app flag)', () => {
    mockIsAppEnabled.mockReturnValue(false)
    renderAction()
    expect(screen.getByRole('button', { name: label() })).toBeInTheDocument()
    expect(mockHasModule).toHaveBeenCalledWith('hf')
  })
  it('is hidden when both the HelloFlex app and the hf module are off', () => {
    mockIsAppEnabled.mockReturnValue(false)
    mockHasModule.mockReturnValue(false)
    renderAction()
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('is hidden while a send is in flight', () => {
    renderAction({ contractStatus: 'sending' })
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('is hidden once sent, with a GUID, or archived; shown after a failed send', () => {
    const { unmount } = renderAction({ contractStatus: 'sent' }); expect(screen.queryByRole('button')).toBeNull(); unmount()
    const r2 = renderAction({ helloflexContractGuid: 'g1' }); expect(screen.queryByRole('button')).toBeNull(); r2.unmount()
    const r3 = renderAction({ archived: true }); expect(screen.queryByRole('button')).toBeNull(); r3.unmount()
    renderAction({ contractStatus: 'failed' }); expect(screen.getByRole('button', { name: label() })).toBeInTheDocument()
  })
})
