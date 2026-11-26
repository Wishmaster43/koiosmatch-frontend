/** WaTextTemplatePicker: active-only options, pick writes body + id, clear keeps draft, hidden when absent. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import i18n from '@/i18n'
import WaTextTemplatePicker from './WaTextTemplatePicker'

const hook = vi.fn()
vi.mock('@/components/whatsappWeb/useWhatsappTextTemplates', () => ({ useWhatsappTextTemplates: (e: boolean) => hook(e) }))

const tpls = [
  { id: 't1', name: 'Welcome', body: 'Hi {{first_name}}', language: 'en', is_active: true },
  { id: 't2', name: 'Old', body: 'x', language: 'nl', is_active: false },
]
const setup = (over: { value?: string | null; templates?: typeof tpls } = {}) => {
  hook.mockReturnValue({ templates: over.templates ?? tpls, placeholders: [] })
  const onPick = vi.fn(); const onIdChange = vi.fn()
  render(<WaTextTemplatePicker value={over.value ?? null} onPick={onPick} onIdChange={onIdChange} />)
  return { onPick, onIdChange }
}
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('WaTextTemplatePicker', () => {
  it('offers only active templates and picks body + id', () => {
    const { onPick, onIdChange } = setup()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('candidates:conversations.textTemplateLabel')) }))
    expect(screen.queryByText(/Old/)).toBeNull()
    fireEvent.click(screen.getByText(/Welcome/))
    expect(onPick).toHaveBeenCalledWith('Hi {{first_name}}')
    expect(onIdChange).toHaveBeenCalledWith('t1')
  })

  it('clearing resets the id and leaves the draft', () => {
    const { onPick, onIdChange } = setup({ value: 't1' })
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common:clearField', { field: i18n.t('candidates:conversations.textTemplateLabel') }) }))
    expect(onIdChange).toHaveBeenCalledWith(null)
    expect(onPick).not.toHaveBeenCalled()
  })

  it('renders nothing without active templates', () => {
    setup({ templates: [tpls[1]] })
    expect(screen.queryByRole('button')).toBeNull()
  })
})
