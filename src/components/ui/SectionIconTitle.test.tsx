/**
 * SectionIconTitle — the muted-icon + SectionTitle header shared by
 * WorkflowRelationsView's Ouders/Kinderen sections and the workflow queue's
 * sections; the trailing slot renders only what the caller passes (e.g. the
 * queue's row-count Caption), never invented internally.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GitBranch } from 'lucide-react'
import SectionIconTitle from './SectionIconTitle'

describe('SectionIconTitle', () => {
  it('renders the caller-resolved title text', () => {
    render(<SectionIconTitle icon={GitBranch} title="Ouders" />)
    expect(screen.getByText('Ouders')).toBeInTheDocument()
  })

  it('renders no trailing content when children are not passed', () => {
    render(<SectionIconTitle icon={GitBranch} title="Kinderen" />)
    expect(screen.queryByText('(3)')).not.toBeInTheDocument()
  })

  it('renders the caller-supplied trailing content (e.g. a row count)', () => {
    render(<SectionIconTitle icon={GitBranch} title="Pending"><span>(3)</span></SectionIconTitle>)
    expect(screen.getByText('(3)')).toBeInTheDocument()
  })
})
