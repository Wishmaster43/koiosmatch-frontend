/** NotificationBell · NOTIF-I18N-1 record chip, actions and remove (split from NotificationBell.test.tsx). */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import NotificationBell from './NotificationBell'
import * as useNotificationsModule from '@/hooks/useNotifications'
import * as notificationTargetModule from './notificationTarget'
import api from '@/lib/api'
import i18n from '@/i18n'

// NOTIF-I18N-1: the restore-candidate action stages/confirms through the real
// koios actions endpoints — mocked (API-CREDITS-1: nothing live).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>
const mockDelete = api.delete as unknown as ReturnType<typeof vi.fn>

// The record chip (KoiosRefChip) opens the drawer via NavigationContext's
// openEntity — mocked the same way KoiosResultCards' own suite does, so the
// click-through can be asserted here without a real router tree.
const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))

afterEach(() => { cleanup(); vi.restoreAllMocks(); mockPost.mockReset(); mockDelete.mockReset(); openEntity.mockClear(); window.location.hash = '' })

// NOTIF-I18N-1: a new-shape row (record/title_key/actions present) renders the
// translated title, the record chip, the executable actions, and offers a trash;
// an old-shape row (neither field present) renders exactly as before, no trash.
// There is no header "mark all read": opening the bell already marks all seen.
describe('NotificationBell · NOTIF-I18N-1 (bell speaks the user\'s language, names the record, undo, remove)', () => {
  it('renders the record chip for a candidate.retention_due row and opens its drawer on click', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{
        id: 'n-1', title: 'ESCALATION: dossier archived too long (AVG)', body: '...', seen: false,
        title_key: null, body_key: null, params: {},
        record: { type: 'candidate', id: 'c-1', label: 'Jane Doe' },
        actions: [],
      }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(), removeNotification: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    const chip = screen.getByText('Jane Doe')
    const chipButton = chip.closest('button')
    expect(chipButton).toBeInTheDocument()
    // Verifier fix (29-09): the chip really opens the record's drawer via
    // NavigationContext's openEntity — not just "renders as a button".
    fireEvent.click(chipButton!)
    expect(openEntity).toHaveBeenCalledWith('candidates', 'c-1')
  })

  it('renders the restore action and stages then confirms exactly {tool: "restore_candidate", input: {candidate_id}}', async () => {
    mockPost.mockImplementation((url: string) => {
      if (url === '/ai/koios/actions/stage') return Promise.resolve({ data: { status: 'staged', action: { id: 'pa-1', title: 'Restore' } } })
      if (url === '/ai/koios/actions/pa-1/confirm') return Promise.resolve({ data: { status: 'executed', data: {} } })
      return Promise.reject(new Error('unexpected url ' + url))
    })
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{
        id: 'n-1', title: 'ESCALATION', body: '...', seen: false,
        title_key: null, body_key: null, params: {},
        record: { type: 'candidate', id: 'c-1', label: 'Jane Doe' },
        actions: [{ key: 'restore_candidate', tool: 'restore_candidate', input: { candidate_id: 'c-1' }, label_key: 'koios.assistant.actions.restore_candidate', tool_label_key: 'koios.tools.restore_candidate' }],
      }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(), removeNotification: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    const restoreButton = screen.getByRole('button', { name: i18n.t('koios.assistant.actions.restore_candidate') })
    fireEvent.click(restoreButton)
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/ai/koios/actions/stage', { tool: 'restore_candidate', input: { candidate_id: 'c-1' } }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/ai/koios/actions/pa-1/confirm', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) })))
  })

  // Lens 1 fix (29-09, §6): Enter/Space on a child control must run THAT control, never
  // bubble into the row's own keyboard navigation — a keyboard user could otherwise never
  // run an action or remove a row.
  it('does not navigate the row when Enter is pressed on an action button inside it', () => {
    const navigateSpy = vi.spyOn(notificationTargetModule, 'navigateToNotificationTarget').mockImplementation(() => {})
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{
        id: 'n-1', title: 'ESCALATION', body: '...', seen: false, entity_type: 'candidate', entity_id: 'c-1',
        title_key: null, body_key: null, params: {},
        record: { type: 'candidate', id: 'c-1', label: 'Jane Doe' },
        actions: [{ key: 'restore_candidate', tool: 'restore_candidate', input: { candidate_id: 'c-1' }, label_key: 'koios.assistant.actions.restore_candidate', tool_label_key: 'koios.tools.restore_candidate' }],
      }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(), removeNotification: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    fireEvent.keyDown(screen.getByRole('button', { name: i18n.t('koios.assistant.actions.restore_candidate') }), { key: 'Enter' })
    expect(navigateSpy).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('')
    // The title button is the navigation control: a real button, keyboard-focusable.
    const titleBtn = screen.getByRole('button', { name: 'ESCALATION' })
    titleBtn.focus()
    expect(titleBtn).toHaveFocus()
    fireEvent.click(titleBtn)
    expect(navigateSpy).toHaveBeenCalledTimes(1)
  })

  // #248: no interactive role may contain another button (nested-interactive).
  it('renders no button nested inside another button or role=button element', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{
        id: 'n-1', title: 'ESCALATION', body: '...', seen: false, entity_type: 'candidate', entity_id: 'c-1',
        title_key: null, body_key: null, params: {},
        record: { type: 'candidate', id: 'c-1', label: 'Jane Doe' },
        actions: [{ key: 'restore_candidate', tool: 'restore_candidate', input: { candidate_id: 'c-1' }, label_key: 'koios.assistant.actions.restore_candidate', tool_label_key: 'koios.tools.restore_candidate' }],
      }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(), removeNotification: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    const list = screen.getByRole('list')
    list.querySelectorAll('button').forEach(b => {
      expect(b.parentElement?.closest('button, [role="button"]')).toBeNull()
    })
    expect(list.querySelector('[role="button"]')).toBeNull()
  })

  it('removes a row via DELETE /notifications/{id}, optimistically', async () => {
    const removeNotification = vi.fn()
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{
        id: 'n-1', title: 'Row', body: '', seen: false, title_key: null, body_key: null, params: {}, record: null, actions: [],
      }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(), removeNotification,
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    fireEvent.click(screen.getByRole('button', { name: i18n.t('notifications.remove') }))
    expect(removeNotification).toHaveBeenCalledWith('n-1')
  })

  it('renders no trash for an old-shape row (no record/title_key/actions field)', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 1, title: 'Old shape row', seen: false }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    expect(screen.queryByRole('button', { name: i18n.t('notifications.remove') })).not.toBeInTheDocument()
  })
})
