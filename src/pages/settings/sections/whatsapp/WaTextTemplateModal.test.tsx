/**
 * WaTextTemplateModal: validation on Save only, the exact onSave payload, and the
 * placeholder picker inserting a named token into the body. Copy is read through the real i18n.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import WaTextTemplateModal from './WaTextTemplateModal'
import { languageDisplayName } from '@/lib/languageNames'

const tt = (k: string) => i18n.t(`settings:waTextTemplates.${k}`)

describe('WaTextTemplateModal', () => {
  it('shows the required lines and does not save without a name and body', async () => {
    const onSave = vi.fn()
    render(<WaTextTemplateModal editing={null} placeholders={[]} onSave={onSave} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: tt('save') }))
    expect(await screen.findByText(tt('nameRequired'))).toBeTruthy()
    expect(screen.getByText(tt('bodyRequired'))).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('does not save a body over 4096 characters and shows the too-long line', async () => {
    const onSave = vi.fn()
    render(<WaTextTemplateModal editing={{ id: '1', name: 'Hello', body: 'x'.repeat(4097), language: 'en', is_active: true }} placeholders={[]} onSave={onSave} onClose={() => {}} />)
    expect(screen.getByText(tt('bodyTooLong'))).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: tt('save') }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('names the name field and marks it required', () => {
    render(<WaTextTemplateModal editing={null} placeholders={[]} onSave={vi.fn()} onClose={() => {}} />)
    expect(screen.getByRole('textbox', { name: new RegExp(tt('name')) }).getAttribute('aria-required')).toBe('true')
  })

  it('stays open when onSave rejects', async () => {
    const onClose = vi.fn()
    const onSave = vi.fn().mockRejectedValue(new Error('x'))
    render(<WaTextTemplateModal editing={{ id: '1', name: 'Hello', body: 'Hi', language: 'en', is_active: true }} placeholders={[]} onSave={onSave} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: tt('save') }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('saves exactly name, body, language and is_active, then closes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<WaTextTemplateModal editing={{ id: '1', name: 'Hello', body: 'Hi there', language: 'en', is_active: false }} placeholders={[]}
      onSave={onSave} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: tt('save') }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ name: 'Hello', body: 'Hi there', language: 'en', is_active: false })
  })

  // DROPDOWN-CLEAR-1 regression: the language picker clears like every form field (pick → clear → empty trigger);
  // Save then refuses with the required line and never sends an empty language.
  it('clears the language with the shared clear button and refuses to save until one is chosen', async () => {
    const onSave = vi.fn()
    render(<WaTextTemplateModal editing={{ id: '1', name: 'Hello', body: 'Hi', language: 'en', is_active: true }} placeholders={[]}
      onSave={onSave} onClose={() => {}} />)
    const picked = languageDisplayName('en', i18n.language)
    const trigger = screen.getByRole('button', { name: new RegExp(tt('language')) })
    expect(trigger).toHaveTextContent(picked)
    const clearBtn = trigger.parentElement!.querySelector('button[id$="-clear"]')
    expect(clearBtn).toBeTruthy()
    await userEvent.click(clearBtn!)
    expect(trigger).not.toHaveTextContent(picked)
    await userEvent.click(screen.getByRole('button', { name: tt('save') }))
    expect(await screen.findByText(tt('languageRequired'))).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('inserts a placeholder token from the picker into the body', async () => {
    render(<WaTextTemplateModal editing={{ id: '1', name: 'Hello', body: 'Hi ', language: 'nl', is_active: true }} placeholders={['first_name']}
      onSave={vi.fn()} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: i18n.t('workflows:vars.title') }))
    const item = await screen.findByText('first_name')
    expect(screen.getByText(tt('placeholdersGroup'))).toBeTruthy()
    expect(screen.queryByText(i18n.t('workflows:vars.notRun'))).toBeNull()
    await userEvent.click(item)
    const area = document.querySelector('textarea') as HTMLTextAreaElement
    expect(area.value).toContain('{{first_name}}')
  })
})
