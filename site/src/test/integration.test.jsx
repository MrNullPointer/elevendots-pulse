import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { mockData } from './fixtures'

function renderApp(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  )
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function advanceIntro(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

async function finishStartup() {
  await flushAsyncWork()
  await advanceIntro(3200)
}

beforeEach(() => {
  vi.useFakeTimers()
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(mockData) })
  )
  localStorage.clear()
  localStorage.setItem('theme', 'light')
  document.documentElement.setAttribute('data-theme', 'light')
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('App startup reveal', () => {
  it('renders the startup overlay immediately with no loading text', () => {
    renderApp()
    expect(screen.getByTestId('startup-reveal')).toBeInTheDocument()
    expect(screen.queryByText('Loading articles...')).not.toBeInTheDocument()
  })

  it('holds the overlay for at least two seconds before revealing content', async () => {
    renderApp()
    await flushAsyncWork()

    expect(screen.getByTestId('startup-reveal')).toHaveAttribute('data-phase', 'intro')
    expect(screen.queryByLabelText('Go to homepage')).not.toBeInTheDocument()

    await advanceIntro(1999)
    expect(screen.getByTestId('startup-reveal')).toBeInTheDocument()
    expect(screen.queryByLabelText('Go to homepage')).not.toBeInTheDocument()

    await advanceIntro(1001)
    expect(screen.queryByTestId('startup-reveal')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Go to homepage')).toBeInTheDocument()
  })

  it('enters holding mode when the network is slower than the intro', async () => {
    let resolveFetch
    global.fetch = vi.fn(() =>
      new Promise((resolve) => {
        resolveFetch = resolve
      })
    )

    renderApp()
    await advanceIntro(2000)
    expect(screen.getByTestId('startup-reveal')).toHaveAttribute('data-phase', 'holding')

    await act(async () => {
      resolveFetch({ ok: true, json: () => Promise.resolve(mockData) })
      await Promise.resolve()
      await Promise.resolve()
    })
    await advanceIntro(1000)

    expect(screen.queryByTestId('startup-reveal')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Go to homepage')).toBeInTheDocument()
  })

  it('does not replay the intro on route changes', async () => {
    renderApp()
    await finishStartup()

    expect(screen.queryByTestId('startup-reveal')).not.toBeInTheDocument()

    // Navigate by finding and clicking a section link/button
    const techButtons = screen.getAllByRole('button', { name: 'Tech' })
    await act(async () => { techButtons[0].click() })
    await flushAsyncWork()

    expect(screen.queryByTestId('startup-reveal')).not.toBeInTheDocument()
  })
})

describe('App integration', () => {
  it('renders homepage with hero section after reveal', async () => {
    renderApp()
    await finishStartup()

    expect(screen.getByLabelText('Featured stories')).toBeInTheDocument()
    expect(screen.getAllByText(mockData.articles[0].title).length).toBeGreaterThanOrEqual(1)
  })

  it('renders section shelves on homepage', async () => {
    renderApp()
    await finishStartup()

    expect(screen.getAllByText('Tech').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Science').length).toBeGreaterThan(0)
  })

  it('renders section page at /tech', async () => {
    renderApp('/tech')
    await finishStartup()

    expect(screen.getByRole('heading', { name: 'Tech' })).toBeInTheDocument()
    expect(screen.getByText('Computing and chips.')).toBeInTheDocument()
  })

  it('renders subsection filters on section page', async () => {
    renderApp('/tech')
    await finishStartup()

    expect(screen.getByRole('tab', { name: /All/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Semiconductor/ })).toBeInTheDocument()
  })

  it('renders time and access filters on section page', async () => {
    renderApp('/tech')
    await finishStartup()

    expect(screen.getByRole('radiogroup', { name: 'Time filter' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Access filter' })).toBeInTheDocument()
  })

  it('shows "Section not found" for invalid section', async () => {
    renderApp('/nonexistent')
    await finishStartup()

    expect(screen.getByText('Section not found.')).toBeInTheDocument()
  })

  it('renders footer', async () => {
    renderApp()
    await finishStartup()

    expect(screen.getByText(/support@elevendots.ai/)).toBeInTheDocument()
  })

  it('handles fetch error gracefully after the intro', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }))
    renderApp()
    await finishStartup()

    expect(screen.getByText('HTTP 500')).toBeInTheDocument()
  })

  it('handles empty articles gracefully after the intro', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ ...mockData, articles: [] }) })
    )
    renderApp()
    await finishStartup()

    expect(screen.getByText(/No articles found/)).toBeInTheDocument()
  })
})

describe('Theme toggle', () => {
  it('toggles dark mode on button click', async () => {
    renderApp()
    await finishStartup()

    const toggleBtn = screen.getByLabelText(/Switch to dark mode/)
    await act(async () => { toggleBtn.click() })
    await flushAsyncWork()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })
})

describe('Section filtering', () => {
  it('filters articles by subsection when tab is clicked', async () => {
    renderApp('/tech')
    await finishStartup()

    const semiTab = screen.getByRole('tab', { name: /Semiconductor/ })
    await act(async () => { semiTab.click() })
    await flushAsyncWork()

    expect(screen.getByText(/2 article/)).toBeInTheDocument()
  })
})
