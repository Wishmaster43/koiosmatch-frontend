/**
 * StepOutputSlice — the run viewer must show a step's OWN output slice
 * (output[module_type]) instead of the merged pipeline blob, collapse lists
 * above 10 rows by default, fall back to the generic item list for a
 * non-passthrough module without a resolvable slice, and — RUN-CONTROL-1
 * polish wave — show a muted note instead of that fallback for a KNOWN
 * passthrough module (its `items` would just repeat the upstream card).
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StepOutputSlice from './StepOutputSlice'
import type { ModuleCatalog } from './filterFieldCatalog'
import type { RunStep } from '@/types/reports'

const catalog: ModuleCatalog = {
  sm_customers: { outputFields: { id: 'Klant-ID', name: 'Klantnaam' }, emits: 'replace' },
  candidate_filter: { outputFields: { id: 'Kandidaat-ID', firstname: 'Voornaam' }, emits: 'replace' },
  whatsapp_send: { outputFields: {}, emits: 'passthrough' },
  wait: { outputFields: {}, emits: 'passthrough' },
  status_set: { outputFields: {}, emits: 'append' },
}

// A merged pipeline output: the step's own slice + an upstream slice + counters.
const step = (rows: Array<Record<string, unknown>>): RunStep => ({
  module_type: 'sm_customers',
  output: {
    sm_customers: rows,
    candidates: [{ name: 'UPSTREAM-ONLY' }],
    sm_sync: { synced: rows.length },
  },
})

describe('StepOutputSlice', () => {
  it('renders only the module\'s own slice, never an upstream slice', () => {
    render(<StepOutputSlice step={step([{ id: 1, name: 'Acme' }])} catalog={catalog} />)
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.queryByText('UPSTREAM-ONLY')).not.toBeInTheDocument()
  })

  it('resolves a replace-module without an own key to the canonical candidates slice', () => {
    const filterStep: RunStep = {
      module_type: 'candidate_filter',
      output: { candidates: [{ id: 9, firstname: 'Fatima' }], count: 1 },
    }
    render(<StepOutputSlice step={filterStep} catalog={catalog} />)
    expect(screen.getByText('Fatima')).toBeInTheDocument()
  })

  it('never claims an upstream candidates list for a passthrough module', () => {
    const sendStep: RunStep = {
      module_type: 'whatsapp_send',
      output: { candidates: [{ id: 9, firstname: 'UPSTREAM-ONLY' }] },
    }
    render(<StepOutputSlice step={sendStep} catalog={catalog} />)
    expect(screen.queryByText('UPSTREAM-ONLY')).not.toBeInTheDocument()
  })

  it('is open by default at 10 rows or fewer', () => {
    render(<StepOutputSlice step={step([{ id: 1, name: 'Acme' }])} catalog={catalog} />)
    expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
  })

  it('is collapsed by default above 10 rows and expands on click', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ id: i, name: `Klant ${i}` }))
    render(<StepOutputSlice step={step(rows)} catalog={catalog} />)
    expect(screen.queryByText('Klant 0')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByText('Klant 0')).toBeInTheDocument()
  })

  it('shows the capped hint when the backend truncated the list', () => {
    const out = step([{ id: 1, name: 'Acme' }])
    ;(out.output as Record<string, unknown>).sm_customers_total = 460
    render(<StepOutputSlice step={out} catalog={catalog} />)
    // A 460-row total starts collapsed — expand, then the cap hint is visible.
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByText('runViewer.capped')).toBeInTheDocument()
  })

  it('falls back to the generic item list for a NON-passthrough step without an own slice', () => {
    const legacy: RunStep = {
      module_type: 'status_set',
      output: { status_updated: 3 },
      items: [{ name: 'Jan Jansen', meta: 'jan@example.test' }] as unknown as RunStep['items'],
    }
    render(<StepOutputSlice step={legacy} catalog={catalog} />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
  })

  it('shows a muted passthrough note instead of the generic item list for a KNOWN passthrough module', () => {
    const waitStep: RunStep = {
      module_type: 'wait',
      output: {},
      items: [{ name: 'Jan Jansen', meta: 'jan@example.test' }] as unknown as RunStep['items'],
    }
    render(<StepOutputSlice step={waitStep} catalog={catalog} />)
    expect(screen.getByText('runViewer.passthrough')).toBeInTheDocument()
    expect(screen.queryByText('Jan Jansen')).not.toBeInTheDocument()
  })

  it('renders nothing when the step emitted no list at all', () => {
    const { container } = render(<StepOutputSlice step={{ module_type: 'router', output: {} }} catalog={catalog} />)
    expect(container.firstChild).toBeNull()
  })
})
