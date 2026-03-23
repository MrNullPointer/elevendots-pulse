import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import SearchOverlay from '../components/SearchOverlay'
import { mockArticles } from './fixtures'

function renderSearch(props = {}) {
  const defaultProps = { articles: mockArticles, isOpen: true, onClose: vi.fn() }
  return render(
    <BrowserRouter>
      <SearchOverlay {...defaultProps} {...props} />
    </BrowserRouter>
  )
}

describe('SearchOverlay', () => {
  it('renders nothing when closed', () => {
    const { container } = renderSearch({ isOpen: false })
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument()
  })
  it('renders dialog when open', () => {
    renderSearch()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
  it('auto-focuses the search input', async () => {
    renderSearch()
    await waitFor(() => {
      expect(screen.getByLabelText('Search query')).toHaveFocus()
    })
  })
  it('shows results for matching query', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(screen.getByLabelText('Search query'), 'samsung')
    await waitFor(() => {
      expect(screen.getByText(/Samsung union/)).toBeInTheDocument()
    }, { timeout: 500 })
  })
  it('shows "no results" for non-matching query', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(screen.getByLabelText('Search query'), 'xyznonexistent')
    await waitFor(() => {
      expect(screen.getByText(/No results for/)).toBeInTheDocument()
    }, { timeout: 500 })
  })
  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderSearch({ onClose })
    await user.click(screen.getByLabelText('Close search'))
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderSearch({ onClose })
    const backdrop = screen.getByRole('dialog')
    await user.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })
  it('shows keyboard navigation hints in the footer bar', () => {
    const { container } = renderSearch()
    const footerBar = container.querySelector('[style*="border-top"]')
    expect(footerBar).not.toBeNull()
    expect(footerBar.textContent).toContain('navigate')
    expect(footerBar.textContent).toContain('close')
  })
  it('results show source info', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(screen.getByLabelText('Search query'), 'NASA')
    await waitFor(() => {
      expect(screen.getByText('Live Science')).toBeInTheDocument()
    }, { timeout: 500 })
  })
})
