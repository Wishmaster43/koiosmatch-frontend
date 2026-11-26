/** ThreadComposerBlock: the text template picker is gated to wa_web threads (the picker mounts only for them). */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import ThreadComposerBlock from './ThreadComposerBlock'
import type { ConversationRow } from './conversationRows'

const hook = vi.fn()
vi.mock('@/components/whatsappWeb/useWhatsappTextTemplates', () => ({ useWhatsappTextTemplates: (e: boolean) => hook(e) }))
vi.mock('./ConversationAssistSection', () => ({
  default: ({ onApply }: { onApply: (t: string) => void }) => <button onClick={() => onApply('ai text')}>assist-apply</button>,
}))
vi.mock('./ThreadComposer', () => ({ default: () => <div /> }))
vi.mock('./TemplateComposer', () => ({ default: () => <div /> }))

const tpl = { id: 't1', name: 'Welcome', body: 'b', language: 'en', is_active: true }
const onTextTemplateIdChange = vi.fn()
const onDraftChange = vi.fn()
const renderBlock = (channel: string) => {
  hook.mockImplementation((e: boolean) => ({ templates: e ? [tpl] : [], placeholders: [] }))
  render(<ThreadComposerBlock row={{ id: 'c1', primary_channel: channel } as ConversationRow}
    win={{ open: true, known: true, msLeft: 1000, expiresAt: null } as never} hasMessages composerEnabled
    draft="" onDraftChange={onDraftChange} textTemplateId="t1" onTextTemplateIdChange={onTextTemplateIdChange} sending={false}
    sendError={null} onSend={vi.fn()} onTemplateSent={vi.fn()} formatDateTime={s => s} language="en" />)
}
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('ThreadComposerBlock text template picker', () => {
  it('renders the picker for a wa_web thread', () => {
    renderBlock('wa_web')
    expect(hook).toHaveBeenCalledWith(true)
    // The trigger is the only expandable match (the clear button shares the name).
    expect(screen.getByRole('button', { name: new RegExp(i18n.t('candidates:conversations.textTemplateLabel')), expanded: false })).toBeTruthy()
  })
  it('clears the template id when the AI assist applies a text', () => {
    renderBlock('wa_web')
    fireEvent.click(screen.getByText('assist-apply'))
    expect(onDraftChange).toHaveBeenCalledWith('ai text')
    expect(onTextTemplateIdChange).toHaveBeenCalledWith(null)
  })
  it('renders no picker for a WABA thread and never mounts the hook', () => {
    renderBlock('whatsapp')
    expect(hook).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: new RegExp(i18n.t('candidates:conversations.textTemplateLabel')) })).toBeNull()
  })
})
