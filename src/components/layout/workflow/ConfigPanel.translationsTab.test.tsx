/**
 * ConfigPanel.translationsTab.test — 02-09 final design: the "Vertalingen" tab
 * appears only for modules whose schema declares a translations-tab field
 * AND whose showIf currently passes (whatsapp_send only in the free-text
 * 'session' format; email_send always), never on the main settings tab, and
 * a format flip away from session falls the active tab back to Settings.
 * Real i18n is not initialized here (mirrors configPanelWaWeb.test.tsx), so
 * `t()` returns the raw key; only `i18n.language` is mocked (to 'nl') so the
 * ICU language name in the translations tab is stable.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfigPanel from './ConfigPanel'
import type { FlowNode } from '@/types/workflow'

// Only pin `i18n.language` to 'nl' (the ICU language name needs a real locale);
// `t()` stays the actual react-i18next fallback (raw key) since no instance is initialized here.
vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return { ...actual, useTranslation: (...args: Parameters<typeof actual.useTranslation>) => {
    const real = actual.useTranslation(...args)
    return { ...real, i18n: { ...real.i18n, language: 'nl' } }
  } }
})

describe('ConfigPanel · translations tab', () => {
  it('shows the Vertalingen tab for a whatsapp_send node in the session (free-text) format', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { message_type: 'session' } } }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('config.tabTranslations')).toBeInTheDocument()
  })

  it('does not show the Vertalingen tab for a whatsapp_send node in the template format', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { message_type: 'template' } } }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('config.tabTranslations')).not.toBeInTheDocument()
  })

  it('does not show the Vertalingen tab for a module without the field (condition)', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'condition', config: {} } }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('config.tabTranslations')).not.toBeInTheDocument()
  })

  it('shows the Vertalingen tab for an email_send node regardless of message_type', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'email_send', config: {} } }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('config.tabTranslations')).toBeInTheDocument()
  })

  it('does not render the translations field label on the main settings tab', () => {
    // fieldLabel() passes a `defaultValue`, so with no i18n instance t() resolves
    // to the raw label "Vertalingen" (not the key "fieldLabels.Vertalingen") —
    // assert on that literal or the guard is vacuous (it would still pass with
    // the translations field leaking onto Settings via a bare label lookup).
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { message_type: 'session' } } }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('Vertalingen', { selector: 'label' })).not.toBeInTheDocument()
  })

  it('clicking the translations tab renders the company-language card, not a repeated field label', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { message_type: 'session' } } }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByText('config.tabTranslations'))
    expect(screen.getByText('translations.companyLanguage')).toBeInTheDocument()
    // Strong form (see the earlier test's comment): defaultValue makes t() render
    // the literal label "Vertalingen", never the key — assert on the literal.
    expect(screen.queryByText('Vertalingen', { selector: 'label' })).not.toBeInTheDocument()
  })

  it('flipping whatsapp_send from session to template while on the translations tab falls back to Settings', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { message_type: 'session' } } }
    const { rerender } = render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByText('config.tabTranslations'))
    expect(screen.getByText('translations.companyLanguage')).toBeInTheDocument()
    const flipped: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { message_type: 'template' } } }
    rerender(<ConfigPanel node={flipped} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('config.tabTranslations')).not.toBeInTheDocument()
    expect(screen.queryByText('translations.companyLanguage')).not.toBeInTheDocument()
    // The fallback itself: the Settings pane is active again (its own field labels render),
    // not an empty translations pane — this line fails when the fallback effect is removed.
    expect(screen.getByText('Kanaal', { selector: 'label' })).toBeInTheDocument()
  })
})
