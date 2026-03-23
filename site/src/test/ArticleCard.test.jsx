import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ArticleCard, { TierBadge, formatAge, computeAge } from '../components/ArticleCard'
import { mockArticles } from './fixtures'

function renderWithRouter(ui) {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('formatAge', () => {
  it('shows "just now" for negative hours', () => {
    expect(formatAge(-1)).toBe('just now')
  })
  it('shows minutes for < 1 hour', () => {
    expect(formatAge(0.5)).toBe('30m ago')
  })
  it('shows hours for < 24 hours', () => {
    expect(formatAge(5)).toBe('5h ago')
  })
  it('shows days for >= 24 hours', () => {
    expect(formatAge(48)).toBe('2d ago')
  })
})

describe('computeAge', () => {
  it('calculates age from published timestamp', () => {
    const article = { published: new Date(Date.now() - 7200000).toISOString(), age_hours: 999 }
    const age = computeAge(article)
    expect(age).toBeGreaterThanOrEqual(1.9)
    expect(age).toBeLessThanOrEqual(2.1)
  })
  it('falls back to age_hours when no published field', () => {
    expect(computeAge({ age_hours: 5 })).toBe(5)
  })
  it('returns 0 for future-dated articles', () => {
    expect(computeAge({ published: new Date(Date.now() + 3600000).toISOString() })).toBe(0)
  })
})

describe('TierBadge', () => {
  it('renders free badge', () => {
    render(<TierBadge tier="free" />)
    expect(screen.getByText('free')).toBeInTheDocument()
  })
  it('renders paid badge with lock icon', () => {
    const { container } = render(<TierBadge tier="paid" />)
    expect(screen.getByText('paid')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
  it('renders freemium badge', () => {
    render(<TierBadge tier="freemium" />)
    expect(screen.getByText('freemium')).toBeInTheDocument()
  })
})

describe('ArticleCard', () => {
  const article = mockArticles[0]

  it('renders article title', () => {
    renderWithRouter(<ArticleCard article={article} />)
    expect(screen.getByText(article.title)).toBeInTheDocument()
  })
  it('renders article intro', () => {
    renderWithRouter(<ArticleCard article={article} />)
    expect(screen.getByText(article.intro)).toBeInTheDocument()
  })
  it('renders source name', () => {
    renderWithRouter(<ArticleCard article={article} />)
    expect(screen.getByText(article.source)).toBeInTheDocument()
  })
  it('renders tier badge', () => {
    renderWithRouter(<ArticleCard article={article} />)
    // Badge text is lowercase in the component
    expect(screen.getByText('freemium')).toBeInTheDocument()
  })
  it('renders subsection tags', () => {
    renderWithRouter(<ArticleCard article={article} />)
    // Tags are rendered uppercase via CSS textTransform, but DOM content is lowercase
    expect(screen.getByText('semiconductor')).toBeInTheDocument()
    expect(screen.getByText('memory')).toBeInTheDocument()
  })
  it('hides intro in compact mode', () => {
    renderWithRouter(<ArticleCard article={article} compact />)
    expect(screen.queryByText(article.intro)).not.toBeInTheDocument()
  })
  it('links to article URL with target="_blank"', () => {
    renderWithRouter(<ArticleCard article={article} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', article.url)
    expect(link).toHaveAttribute('target', '_blank')
  })
  it('renders also_from indicator when sources exist', () => {
    renderWithRouter(<ArticleCard article={article} />)
    expect(screen.getByText('+1 source')).toBeInTheDocument()
  })
  it('does not render also_from when empty', () => {
    renderWithRouter(<ArticleCard article={mockArticles[1]} />)
    expect(screen.queryByText(/\+\d+ source/)).not.toBeInTheDocument()
  })
  it('uses semantic <article> tag', () => {
    renderWithRouter(<ArticleCard article={article} />)
    expect(screen.getByRole('article')).toBeInTheDocument()
  })
})
