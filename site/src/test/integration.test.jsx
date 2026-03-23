import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { mockData } from './fixtures'

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(mockData) })
  )
  localStorage.clear()
  document.documentElement.setAttribute('data-theme', 'light')
})

function renderApp(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  )
}

describe('App integration', () => {
  it('shows loading state then renders content', async () => {
    renderApp()
    expect(screen.getByText('Loading articles...')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByLabelText('Go to homepage')).toBeInTheDocument()
    })
  })

  it('renders homepage with hero section', async () => {
    renderApp()
    await waitFor(() => {
      expect(screen.getByLabelText('Featured stories')).toBeInTheDocument()
      // Title appears in both hero and shelf — getAllByText confirms it renders
      expect(screen.getAllByText(mockData.articles[0].title).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders section shelves on homepage', async () => {
    renderApp()
    await waitFor(() => {
      // Section headings are in the shelves
      expect(screen.getAllByText('Tech').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Science').length).toBeGreaterThan(0)
    })
  })

  it('renders section page at /tech', async () => {
    renderApp('/tech')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tech' })).toBeInTheDocument()
      expect(screen.getByText('Computing and chips.')).toBeInTheDocument()
    })
  })

  it('renders subsection filters on section page', async () => {
    renderApp('/tech')
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /All/ })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Semiconductor/ })).toBeInTheDocument()
    })
  })

  it('renders time and access filters on section page', async () => {
    renderApp('/tech')
    await waitFor(() => {
      expect(screen.getByRole('radiogroup', { name: 'Time filter' })).toBeInTheDocument()
      expect(screen.getByRole('radiogroup', { name: 'Access filter' })).toBeInTheDocument()
    })
  })

  it('shows "Section not found" for invalid section', async () => {
    renderApp('/nonexistent')
    await waitFor(() => {
      expect(screen.getByText('Section not found.')).toBeInTheDocument()
    })
  })

  it('renders footer', async () => {
    renderApp()
    await waitFor(() => {
      expect(screen.getByText(/contact@elevendots.dev/)).toBeInTheDocument()
    })
  })

  it('handles fetch error gracefully', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }))
    renderApp()
    await waitFor(() => {
      expect(screen.getByText('HTTP 500')).toBeInTheDocument()
    })
  })

  it('handles empty articles gracefully', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ ...mockData, articles: [] }) })
    )
    renderApp()
    await waitFor(() => {
      expect(screen.getByText(/No articles found/)).toBeInTheDocument()
    })
  })
})

describe('Theme toggle', () => {
  it('toggles dark mode on button click', async () => {
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(screen.getByLabelText(/Switch to dark mode/)).toBeInTheDocument())
    await user.click(screen.getByLabelText(/Switch to dark mode/))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })
})

describe('Section filtering', () => {
  it('filters articles by subsection when tab is clicked', async () => {
    const user = userEvent.setup()
    renderApp('/tech')
    await waitFor(() => expect(screen.getByRole('tab', { name: /Semiconductor/ })).toBeInTheDocument())
    await user.click(screen.getByRole('tab', { name: /Semiconductor/ }))
    await waitFor(() => {
      expect(screen.getByText(/2 article/)).toBeInTheDocument()
    })
  })
})
