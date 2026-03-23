import { useState, useEffect, useCallback, useMemo } from 'react'
import { Routes, Route, useParams, useSearchParams } from 'react-router-dom'
import { useArticles } from './hooks/useArticles'
import { useFilters } from './hooks/useFilters'
import NeuralBackground from './components/NeuralBackground'
import AtmosphereOrbs from './components/AtmosphereOrbs'
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
import KeyboardHelp from './components/KeyboardHelp'
import SourceHealth from './components/SourceHealth'
import Footer from './components/Footer'

const ACCENT_MAP = {
  tech:       { color: '#4080ff', rgb: '64,128,255' },
  science:    { color: '#a050ff', rgb: '160,80,255' },
  philosophy: { color: '#e0a030', rgb: '224,160,48' },
  misc:       { color: '#a0a0c0', rgb: '160,160,192' },
}

function useAccent(section) {
  useEffect(() => {
    const accent = ACCENT_MAP[section]
    if (accent) {
      document.documentElement.style.setProperty('--accent-current', accent.color)
      document.documentElement.style.setProperty('--accent-rgb', accent.rgb)
    } else {
      document.documentElement.style.setProperty('--accent-current', '#6868e0')
      document.documentElement.style.setProperty('--accent-rgb', '104,104,224')
    }
  }, [section])
}

// Cursor tracking for glass glow effect
function useCursorGlow() {
  useEffect(() => {
    if (window.innerWidth < 768) return
    const handler = (e) => {
      document.documentElement.style.setProperty('--mx', e.clientX + 'px')
      document.documentElement.style.setProperty('--my', e.clientY + 'px')
    }
    window.addEventListener('mousemove', handler, { passive: true })
    return () => window.removeEventListener('mousemove', handler)
  }, [])
}

// Scroll-linked specular shift
function useScrollSpecular() {
  useEffect(() => {
    const handler = () => {
      const pct = (window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)) * 100
      document.documentElement.style.setProperty('--scroll-pct', pct + '%')
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
}

function App() {
  const { articles, sections, sectionsMetadata, subsectionsMetadata, sourceHealth, generatedAt, loading, error } = useArticles()
  const [searchOpen, setSearchOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [previewArticle, setPreviewArticle] = useState(null)
  const [currentSection, setCurrentSection] = useState('home')

  useCursorGlow()
  useScrollSpecular()

  // ⌘K search shortcut
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

  // Konami code: ↑↑↓↓←→←→BA → neural dots form "11"
  useEffect(() => {
    const code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA']
    let pos = 0
    const handler = (e) => {
      if (e.code === code[pos]) {
        pos++
        if (pos === code.length) {
          pos = 0
          window.dispatchEvent(new CustomEvent('konami'))
        }
      } else {
        pos = 0
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
    <div className="min-h-screen relative">
      <AtmosphereOrbs />
      <NeuralBackground activeSection={currentSection} searchOpen={searchOpen} />
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
              onSectionChange={setCurrentSection}
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
              onHelpToggle={() => setHelpOpen(o => !o)}
              searchOpen={searchOpen}
              helpOpen={helpOpen}
              onSectionChange={setCurrentSection}
            />
          }
        />
      </Routes>

      <SearchOverlay
        articles={articles}
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
      <KeyboardHelp
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </div>
  )
}

function HomePage({
  articles, sections, sectionsMetadata, subsectionsMetadata,
  sourceHealth, generatedAt, onSearchOpen, onPreview,
  previewArticle, onClosePreview, onSectionChange,
}) {
  useAccent(null) // home accent
  useEffect(() => { onSectionChange?.('home') }, [onSectionChange])

  return (
    <>
      <GradientMesh activeSection="tech" />
      <GlassNavbar
        sections={sections}
        activeSection={null}
        onSearchOpen={onSearchOpen}
      />

      <main className="max-w-7xl mx-auto px-4 pt-6 relative z-10">
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
  previewArticle, onClosePreview, onHelpToggle,
  searchOpen, helpOpen, onSectionChange,
}) {
  const { section } = useParams()
  const [searchParams] = useSearchParams()
  const meta = sectionsMetadata[section]
  const [focusedIndex, setFocusedIndex] = useState(-1)

  useAccent(section)
  useEffect(() => { onSectionChange?.(section || 'home') }, [section, onSectionChange])

  const sectionArticles = useMemo(
    () => articles.filter(a => a.section === section),
    [articles, section]
  )

  const {
    filtered, activeSubsection, setActiveSubsection,
    timeFilter, setTimeFilter, accessFilter, setAccessFilter,
  } = useFilters(sectionArticles)

  useEffect(() => {
    const sub = searchParams.get('sub')
    if (sub) setActiveSubsection(sub)
  }, [searchParams, setActiveSubsection])

  // Reset focus when filters change
  useEffect(() => {
    setFocusedIndex(-1)
  }, [activeSubsection, timeFilter, accessFilter])

  // Keyboard navigation: j/k/Enter/?
  useEffect(() => {
    if (searchOpen || helpOpen) return
    const handler = (e) => {
      // Don't capture when typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 'j') {
        e.preventDefault()
        setFocusedIndex(i => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'k') {
        e.preventDefault()
        setFocusedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && focusedIndex >= 0 && filtered[focusedIndex]) {
        e.preventDefault()
        window.open(filtered[focusedIndex].url, '_blank', 'noopener,noreferrer')
      } else if (e.key === '?') {
        e.preventDefault()
        onHelpToggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filtered, focusedIndex, searchOpen, helpOpen, onHelpToggle])

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

      <main className="max-w-7xl mx-auto px-4 pt-4 relative z-10">
        <div className="mb-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: meta.theme_color }}
              aria-hidden="true"
            />
            <h1 className="font-medium section-title-gradient" style={{ fontSize: '22px' }}>
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
            <div className="w-px h-4" style={{ background: 'var(--glass-border)' }} />
            <AccessFilter active={accessFilter} onSelect={setAccessFilter} />
            <span className="font-mono ml-auto opacity-40" style={{ fontSize: '10px' }}>
              {filtered.length} article{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {previewArticle && (
          <PreviewPanel article={previewArticle} onClose={onClosePreview} />
        )}

        <ArticleGrid articles={filtered} onPreview={onPreview} focusedIndex={focusedIndex} />

        <div className="mt-8">
          <SourceHealth sources={sourceHealth} />
        </div>
        <Footer generatedAt={generatedAt} sourceCount={sourceHealth?.length || 0} />
      </main>
    </>
  )
}

export default App
