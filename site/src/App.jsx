import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, useParams, useSearchParams } from 'react-router-dom'
import { useArticles } from './hooks/useArticles'
import { useFilters } from './hooks/useFilters'
import GlassNavbar from './components/GlassNavbar'
import GradientMesh from './components/GradientMesh'
import HeroSection from './components/HeroSection'
import TrendingStrip from './components/TrendingStrip'
import SectionShelf from './components/SectionShelf'
import SubsectionBar from './components/SubsectionBar'
import TimeFilter from './components/TimeFilter'
import AccessFilter from './components/AccessFilter'
import ArticleGrid from './components/ArticleGrid'
import PreviewPanel from './components/PreviewPanel'
import SearchOverlay from './components/SearchOverlay'
import SourceHealth from './components/SourceHealth'
import Footer from './components/Footer'

function App() {
  const { articles, sections, sectionsMetadata, subsectionsMetadata, sourceHealth, generatedAt, articleCount, loading, error } = useArticles()
  const [searchOpen, setSearchOpen] = useState(false)
  const [previewArticle, setPreviewArticle] = useState(null)

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handlePreview = useCallback((article) => {
    setPreviewArticle(article)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Loading articles...</p>
      </div>
    )
  }

  if (error || !articles.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>
          {error || 'No articles found. Run the crawler first.'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              articles={articles}
              sections={sections}
              sectionsMetadata={sectionsMetadata}
              subsectionsMetadata={subsectionsMetadata}
              sourceHealth={sourceHealth}
              generatedAt={generatedAt}
              onSearchOpen={() => setSearchOpen(true)}
              onPreview={handlePreview}
              previewArticle={previewArticle}
              onClosePreview={() => setPreviewArticle(null)}
            />
          }
        />
        <Route
          path="/:section"
          element={
            <SectionPage
              articles={articles}
              sections={sections}
              sectionsMetadata={sectionsMetadata}
              subsectionsMetadata={subsectionsMetadata}
              sourceHealth={sourceHealth}
              generatedAt={generatedAt}
              onSearchOpen={() => setSearchOpen(true)}
              onPreview={handlePreview}
              previewArticle={previewArticle}
              onClosePreview={() => setPreviewArticle(null)}
            />
          }
        />
      </Routes>

      <SearchOverlay
        articles={articles}
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </div>
  )
}

function HomePage({
  articles, sections, sectionsMetadata, subsectionsMetadata,
  sourceHealth, generatedAt, onSearchOpen, onPreview,
  previewArticle, onClosePreview,
}) {
  return (
    <>
      <GradientMesh activeSection="tech" />
      <GlassNavbar
        sections={sections}
        activeSection={null}
        onSearchOpen={onSearchOpen}
      />

      <main className="max-w-5xl mx-auto px-4 pt-6">
        <HeroSection articles={articles} sectionsMetadata={sectionsMetadata} />
        <TrendingStrip articles={articles} subsectionsMetadata={subsectionsMetadata} />

        {previewArticle && (
          <PreviewPanel article={previewArticle} onClose={onClosePreview} />
        )}

        {sections.map(section => (
          <SectionShelf
            key={section.id}
            sectionId={section.id}
            meta={section}
            articles={articles}
            onPreview={onPreview}
          />
        ))}

        <SourceHealth sources={sourceHealth} />
        <Footer generatedAt={generatedAt} sourceCount={sourceHealth?.length || 0} />
      </main>
    </>
  )
}

function SectionPage({
  articles, sections, sectionsMetadata, subsectionsMetadata,
  sourceHealth, generatedAt, onSearchOpen, onPreview,
  previewArticle, onClosePreview,
}) {
  const { section } = useParams()
  const [searchParams] = useSearchParams()
  const meta = sectionsMetadata[section]

  const sectionArticles = articles.filter(a => a.section === section)
  const {
    filtered, activeSubsection, setActiveSubsection,
    timeFilter, setTimeFilter, accessFilter, setAccessFilter,
  } = useFilters(sectionArticles)

  useEffect(() => {
    const sub = searchParams.get('sub')
    if (sub) setActiveSubsection(sub)
  }, [searchParams, setActiveSubsection])

  if (!meta) {
    return (
      <>
        <GradientMesh activeSection="tech" />
        <GlassNavbar sections={sections} activeSection={null} onSearchOpen={onSearchOpen} />
        <main className="max-w-5xl mx-auto px-4 pt-12 text-center">
          <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Section not found.</p>
        </main>
      </>
    )
  }

  return (
    <>
      <GradientMesh activeSection={section} />
      <GlassNavbar
        sections={sections}
        activeSection={section}
        onSearchOpen={onSearchOpen}
      />

      <main className="max-w-5xl mx-auto px-4 pt-4">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: meta.theme_color }}
            />
            <h1 className="font-medium" style={{ fontSize: '20px' }}>
              {meta.display_name}
            </h1>
            <span className="font-mono opacity-50" style={{ fontSize: '11px' }}>
              {sectionArticles.length}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {meta.description}
          </p>
        </div>

        <div className="space-y-2.5 mb-4">
          <SubsectionBar
            articles={articles}
            sectionId={section}
            subsectionsMetadata={subsectionsMetadata}
            active={activeSubsection}
            onSelect={setActiveSubsection}
          />

          <div className="flex items-center gap-3 flex-wrap">
            <TimeFilter active={timeFilter} onSelect={setTimeFilter} />
            <div className="w-px h-4 bg-white/20" />
            <AccessFilter active={accessFilter} onSelect={setAccessFilter} />
            <span className="font-mono ml-auto opacity-40" style={{ fontSize: '10px' }}>
              {filtered.length} article{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {previewArticle && (
          <PreviewPanel article={previewArticle} onClose={onClosePreview} />
        )}

        <ArticleGrid articles={filtered} onPreview={onPreview} />

        <div className="mt-8">
          <SourceHealth sources={sourceHealth} />
        </div>
        <Footer generatedAt={generatedAt} sourceCount={sourceHealth?.length || 0} />
      </main>
    </>
  )
}

export default App
