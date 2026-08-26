/**
 * configPanelItemsPlural.test — regression for the execution-output tab's item
 * count. It used to hand-build singular/plural with a ternary
 * (`output.length === 1 ? t('config.item') : t('config.items')`); now it goes
 * through i18next's real ICU `_one`/`_other` forms via
 * `t('config.itemsCount', { count })`, so a locale can pick its own plural rule
 * instead of the code hardcoding the Dutch/English two-form split.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import ConfigPanel from './ConfigPanel'
import type { FlowNode } from '@/types/workflow'

const baseNode: FlowNode = {
  id: 'n1', position: { x: 0, y: 0 },
  data: { type: 'whatsapp_send', config: { channel: 'waba' }, output: [{ id: 1 }, { id: 2 }] },
}

describe('ConfigPanel · execution-output item count (ICU plural)', () => {
  it('renders the plural form for a multi-row array output', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ConfigPanel node={baseNode} onUpdate={() => {}} onDelete={() => {}} />
      </I18nextProvider>,
    )
    fireEvent.click(screen.getByRole('tab', { name: /Uitvoering/ }))
    expect(screen.getByText('2 items')).toBeInTheDocument()
  })

  it('renders the singular form for a single-row array output', () => {
    const single: FlowNode = { ...baseNode, data: { ...baseNode.data, output: [{ id: 1 }] } }
    render(
      <I18nextProvider i18n={i18n}>
        <ConfigPanel node={single} onUpdate={() => {}} onDelete={() => {}} />
      </I18nextProvider>,
    )
    fireEvent.click(screen.getByRole('tab', { name: /Uitvoering/ }))
    expect(screen.getByText('1 item')).toBeInTheDocument()
  })
})
