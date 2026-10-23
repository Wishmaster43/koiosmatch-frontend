/** TenantProvisioningChip — pending/failed show their label, ready/null render nothing. */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TenantProvisioningChip from './TenantProvisioningChip'

describe('TenantProvisioningChip', () => {
  it('labels pending and failed bureaus', () => {
    const { rerender } = render(<TenantProvisioningChip status="pending" />)
    expect(screen.getByText('tenantPick.statusPending')).toBeInTheDocument()
    rerender(<TenantProvisioningChip status="failed" />)
    expect(screen.getByText('tenantPick.statusFailed')).toBeInTheDocument()
  })

  it('renders nothing for ready, null or absent', () => {
    const { container, rerender } = render(<TenantProvisioningChip status="ready" />)
    expect(container).toBeEmptyDOMElement()
    rerender(<TenantProvisioningChip status={null} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<TenantProvisioningChip status={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})
