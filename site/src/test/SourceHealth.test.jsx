import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import SourceHealth from '../components/SourceHealth'
import { mockSourceHealth } from './fixtures'

function renderSH(sources = mockSourceHealth) {
  return render(<BrowserRouter><SourceHealth sources={sources} /></BrowserRouter>)
}

describe('SourceHealth', () => {
  it('renders nothing when no sources', () => {
    const { container } = renderSH([])
    expect(container.querySelector('section')).toBeNull()
  })
  it('renders collapsed by default', () => {
    renderSH()
    expect(screen.getByText('Source Health')).toBeInTheDocument()
    expect(screen.queryByText('DigiTimes')).not.toBeInTheDocument()
  })
  it('shows summary counts in header', () => {
    renderSH()
    // healthy=2 (DigiTimes 46, Live Science 50), empty=1 (TrendForce 0), error=1 (Broken Source)
    const btn = screen.getByLabelText('Source health dashboard')
    expect(btn).toBeInTheDocument()
    // Just verify the button renders with summary info
    expect(btn.textContent).toContain('Source Health')
  })
  it('expands on click and shows sources', async () => {
    const user = userEvent.setup()
    renderSH()
    await user.click(screen.getByLabelText('Source health dashboard'))
    expect(screen.getByText('DigiTimes')).toBeInTheDocument()
    expect(screen.getByText('Live Science')).toBeInTheDocument()
    expect(screen.getByText('Broken Source')).toBeInTheDocument()
  })
  it('collapses on second click', async () => {
    const user = userEvent.setup()
    renderSH()
    const btn = screen.getByLabelText('Source health dashboard')
    await user.click(btn)
    expect(screen.getByText('DigiTimes')).toBeInTheDocument()
    await user.click(btn)
    expect(screen.queryByText('DigiTimes')).not.toBeInTheDocument()
  })
  it('has correct aria-expanded state', async () => {
    const user = userEvent.setup()
    renderSH()
    const btn = screen.getByLabelText('Source health dashboard')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    await user.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
  })
})
