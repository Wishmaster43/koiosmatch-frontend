/**
 * ConfigPanel.translationsTab.test — 02-09 final design: the "Vertalingen" tab
 * appears only for modules whose schema declares a translations-tab field
 * AND whose showIf currently passes (whatsapp_send only in the free-text
 * 'session' format; email_send always), never on the main settings tab, and
 * a format flip away from session falls the active tab back to Settings.
 * i18n IS initialized here (mirrors configPanelWaWeb.test.tsx) so translations render.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import ConfigPanel from './ConfigPanel'
import type { FlowNode } from '@/types/workflow'

describe('ConfigPanel · translations tab', () => {
  it('shows the Vertalingen tab for a whatsapp_send node in the session (free-text) format', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { message_type: 'session' } } }
    render(
    <I18nextProvider i18n={i18n}>
      <ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />
    </I18nextProvider>,
  )
    expect(screen.getByText('Vertalingen')).toBeInTheDocument()
  })

  it('does not show the Vertalingen tab for a whatsapp_send node in the template format', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { message_type: 'template' } } }
    render(
    <I18nextProvider i18n={i18n}>
      <ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />
    </I18nextProvider>,
  )
    expect(screen.queryByText('Vertalingen')).not.toBeInTheDocument()
  })

  it('does not show the Vertalingen tab for a module without the field (condition)', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'condition', config: {} } }
    render(
    <I18nextProvider i18n={i18n}>
      <ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />
    </I18nextProvider>,
  )
    expect(screen.queryByText('Vertalingen')).not.toBeInTheDocument()
  })

  it('shows the Vertalingen tab for an email_send node regardless of message_type', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'email_send', config: {} } }
    render(
    <I18nextProvider i18n={i18n}>
      <ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />
    </I18nextProvider>,
  )
    expect(screen.getByText('Vertalingen')).toBeInTheDocument()
  })

  it('does not render the translations field label on the main settings tab', () => {
    // fieldLabel() passes a `defaultValue`, so with no i18n instance t() resolves
    // to the raw label "Vertalingen" (not the key "fieldLabels.Vertalingen") —
    // assert on that literal or the guard is vacuous (it would still pass with
    // the translations field leaking onto Settings via a bare label lookup).
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { message_type: 'session' } } }
    render(
    <I18nextProvider i18n={i18n}>
      <ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />
    </I18nextProvider>,
  )
    expect(screen.queryByText('Vertalingen', { selector: 'label' })).not.toBeInTheDocument()
  })

  it('clicking the translations tab renders the company-language card, not a repeated field label', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { message_type: 'session' } } }
    render(
    <I18nextProvider i18n={i18n}>
      <ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />
    </I18nextProvider>,
  )
    fireEvent.click(screen.getByText('Vertalingen'))
    expect(screen.getByText('Bedrijfstaal')).toBeInTheDocument()
    // Strong form (see the earlier test's comment): defaultValue makes t() render
    // the literal label "Vertalingen", never the key — assert on the literal.
    expect(screen.queryByText('Vertalingen', { selector: 'label' })).not.toBeInTheDocument()
  })

  it('flipping whatsapp_send from session to template while on the translations tab falls back to Settings', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { message_type: 'session' } } }
    const { rerender } = render(
    <I18nextProvider i18n={i18n}>
      <ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />
    </I18nextProvider>,
  )
    fireEvent.click(screen.getByText('Vertalingen'))
    expect(screen.getByText('Bedrijfstaal')).toBeInTheDocument()
    const flipped: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { message_type: 'template' } } }
    rerender(
    <I18nextProvider i18n={i18n}>
      <ConfigPanel node={flipped} onUpdate={vi.fn()} onDelete={vi.fn()} />
    </I18nextProvider>,
  )
    expect(screen.queryByText('Vertalingen')).not.toBeInTheDocument()
    expect(screen.queryByText('Bedrijfstaal')).not.toBeInTheDocument()
    // The fallback itself: the Settings pane is active again (its own field labels render),
    // not an empty translations pane — this line fails when the fallback effect is removed.
    expect(screen.getByText('Kanaal', { selector: 'label' })).toBeInTheDocument()
  })
})
