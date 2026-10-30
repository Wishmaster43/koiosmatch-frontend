/**
 * configPanelItemsPlural.test — regression for the execution-output tab's item
 * count. It used to hand-build singular/plural with a ternary
 * (`output.length === 1 ? t('config.item') : t('config.items')`); now it goes
 * through i18next's real ICU `_one`/`_other` forms via
 * `t('config.itemsCount', { count })`, so a locale can pick its own plural rule
 * instead of the code hardcoding the Dutch/English two-form split.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import ConfigPanel from './ConfigPanel'
import type { FlowNode } from '@/types/workflow'

// The rendered tree fires lookup requests this test never awaits; the real client would reject them with a
// network error AFTER the last test and log "API Error" during worker teardown, which vitest 5 counts as an
// unhandled error. The stub rejects the same way (error state stays identical) without the client's logging.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  const offline = () => Promise.reject(new Error('network disabled in this test'))
  return { ...actual, default: { get: vi.fn(offline), post: vi.fn(offline), put: vi.fn(offline), patch: vi.fn(offline), delete: vi.fn(offline), request: vi.fn(offline) } }
})
// The lookup fields are not under test (the items wording is what matters here): mocking the hook keeps the
// three WhatsApp lookups from being requested at all, so nothing can log during worker teardown (TEARDOWN-LOG-1).
vi.mock('./fieldControls/useLookupOptions', () => ({
  useLookupOptions: () => ({ opts: [], error: false, loading: false, retry: vi.fn() }),
}))

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
