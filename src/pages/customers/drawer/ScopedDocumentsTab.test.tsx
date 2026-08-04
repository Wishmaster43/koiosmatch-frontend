/**
 * ScopedDocumentsTab — DOCTYPE-SCOPE-1 (audit finding, 05-08): a location/
 * department drill-down's own document uploads must consult THEIR OWN
 * document-type lookup ('customer_location' / 'customer_department'), never
 * silently fall back to the customer-level one. Only the PROP handed to the
 * shared DocumentsTab is asserted here — DocumentsTab's own behaviour once it
 * has a scope is covered by DocumentsTab.test.tsx.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScopedDocumentsTab from './ScopedDocumentsTab'

vi.mock('./DocumentsTab', () => ({
  default: ({ docTypeScope, listUrl, lockedLevelFields }: { docTypeScope?: string; listUrl?: string; lockedLevelFields?: Record<string, string> }) => (
    <div data-testid="documents-tab" data-doc-type-scope={docTypeScope} data-list-url={listUrl} data-locked={JSON.stringify(lockedLevelFields)} />
  ),
}))

describe('ScopedDocumentsTab · document-type scope (DOCTYPE-SCOPE-1)', () => {
  it('locks a location drill-down to the customer_location document-type lookup', () => {
    render(<ScopedDocumentsTab scope="location" id="loc-1" customerId="cust-1" />)
    expect(screen.getByTestId('documents-tab')).toHaveAttribute('data-doc-type-scope', 'customer_location')
  })

  it('locks a department drill-down to the customer_department document-type lookup', () => {
    render(<ScopedDocumentsTab scope="department" id="dep-1" customerId="cust-1" />)
    expect(screen.getByTestId('documents-tab')).toHaveAttribute('data-doc-type-scope', 'customer_department')
  })
})
