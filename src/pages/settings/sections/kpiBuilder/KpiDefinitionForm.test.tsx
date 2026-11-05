import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import KpiDefinitionForm from './KpiDefinitionForm'
import { KPI_LABEL_MAX } from './kpiDefinitionsApi'
import type { KpiEntityRegistry } from './kpiDefinitionsApi'

const REGISTRY: KpiEntityRegistry = {
  metrics: [{ key: 'new_in_period', label: 'New matches', kind: 'count', default_unit: 'count' }],
  dimensions: ['all'],
}

describe('KpiDefinitionForm', () => {
  // The label input carries the browser-visible cap matching the draft clamp.
  it('caps the label input at KPI_LABEL_MAX', () => {
    render(<KpiDefinitionForm entity="match" registry={REGISTRY} editing={null} onSubmit={vi.fn()} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText(i18n.t('kpiBuilder.placeholder.label', { ns: 'settings' }))
    expect(input).toHaveAttribute('maxlength', String(KPI_LABEL_MAX))
    expect(KPI_LABEL_MAX).toBe(255)
  })
})
