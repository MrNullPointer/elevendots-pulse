import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'

/**
 * Elevendots-Pulse App Shell
 * 
 * This is a minimal starter. Claude Code will build out the full component tree:
 * - GlassNavbar, SectionTabs, SubsectionBar, TimeFilter
 * - HeroSection, TrendingStrip, SectionShelf
 * - ArticleCard, ArticleGrid, PreviewPanel
 * - SearchOverlay, ThemeToggle, GradientMesh
 * - SourceHealth
 * 
 * See GUIDE.md Phase 2 for the full prompt.
 */

function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/articles.json')
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(err => { console.error('Failed to load articles:', err); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
        <p style={{ color: '#888', fontSize: '14px' }}>Loading articles...</p>
      </div>
    )
  }

  if (!data || !data.articles) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
        <p style={{ color: '#888', fontSize: '14px' }}>No articles found. Run the crawler first: <code>python -m crawler.main</code></p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<HomePage data={data} />} />
        <Route path="/:section" element={<SectionPage data={data} />} />
      </Routes>
    </div>
  )
}

function HomePage({ data }) {
  const { articles, sections_metadata, generated_at } = data

  // Group articles by section
  const sections = Object.entries(sections_metadata || {})
    .sort(([,a], [,b]) => (a.order || 99) - (b.order || 99))

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'DM Sans, sans-serif' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 500 }}>
          <span style={{ color: '#3b6bdf' }}>eleven</span>dots.dev
        </h1>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
          {data.article_count} articles from {data.source_health?.length || 0} sources · Updated {new Date(generated_at).toLocaleString()}
        </p>
      </header>

      {sections.map(([sectionId, meta]) => {
        const sectionArticles = articles
          .filter(a => a.section === sectionId)
          .slice(0, 3)

        if (sectionArticles.length === 0) return null

        return (
          <section key={sectionId} style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.theme_color || '#666', display: 'inline-block' }}></span>
              {meta.display_name}
              <span style={{ fontSize: '12px', color: '#888', fontWeight: 400 }}> — {meta.description}</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
              {sectionArticles.map(article => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block', padding: '14px', borderRadius: '12px',
                    border: '0.5px solid rgba(0,0,0,0.08)', textDecoration: 'none', color: 'inherit',
                    background: 'rgba(255,255,255,0.85)',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1.4, marginBottom: '6px' }}>
                    {article.title}
                  </div>
                  {article.intro && (
                    <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.5, marginBottom: '8px',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {article.intro}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#888' }}>
                    <span style={{ fontWeight: 500 }}>{article.source}</span>
                    <span style={{
                      fontSize: '9px', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase',
                      background: article.tier === 'paid' ? 'rgba(245,158,11,0.12)' : 'rgba(22,163,74,0.1)',
                      color: article.tier === 'paid' ? '#b45309' : '#15803d',
                    }}>
                      {article.tier}
                    </span>
                    <span>{Math.round(article.age_hours)}h ago</span>
                    {article.also_from?.length > 0 && (
                      <span style={{ fontStyle: 'italic' }}>+{article.also_from.length} more</span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function SectionPage({ data }) {
  // Placeholder — Claude Code will build the full section page
  return <HomePage data={data} />
}

export default App
