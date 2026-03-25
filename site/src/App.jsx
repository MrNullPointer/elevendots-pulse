import { useState, useEffect, useCallback, useMemo } from 'react'
import { Routes, Route, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useArticles } from './hooks/useArticles'
import { useFilters } from './hooks/useFilters'
import { useStartupReveal } from './hooks/useStartupReveal'
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
import StartupReveal from './components/StartupReveal'

const ACCENT_MAP = {
  tech:       { color: '#4080ff', rgb: '64,128,255' },
  science:    { color: '#a050ff', rgb: '160,80,255' },
  philosophy: { color: '#e0a030', rgb: '224,160,48' },
  world:      { color: '#dc2626', rgb: '220,38,38' },
  research:   { color: '#10b981', rgb: '16,185,129' },
  misc:       { color: '#a0a0c0', rgb: '160,160,192' },
}

const KNOWN_SECTIONS = new Set(['tech', 'science', 'philosophy', 'world', 'research', 'misc'])

function resolveVisualSection(pathname) {
  const section = pathname.split('/').filter(Boolean)[0]
  return KNOWN_SECTIONS.has(section) ? section : 'home'
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
function useCursorGlow(enabled = true) {
  useEffect(() => {
    if (!enabled || window.innerWidth < 768) return
    const handler = (e) => {
      document.documentElement.style.setProperty('--mx', e.clientX + 'px')
      document.documentElement.style.setProperty('--my', e.clientY + 'px')
    }
    window.addEventListener('mousemove', handler, { passive: true })
    return () => window.removeEventListener('mousemove', handler)
  }, [enabled])
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

function usePrefersReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = () => setReduceMotion(media.matches)

    media.addEventListener?.('change', handleChange)
    media.addListener?.(handleChange)

    return () => {
      media.removeEventListener?.('change', handleChange)
      media.removeListener?.(handleChange)
    }
  }, [])

  return reduceMotion
}

function useDocumentTheme() {
  const [theme, setTheme] = useState(() =>
    document.documentElement.getAttribute('data-theme') || 'dark'
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'dark')
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    return () => observer.disconnect()
  }, [])

  return theme
}

function FallbackState({ message }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative z-10">
      <div className="startup-fallback glass text-center max-w-md w-full px-6 py-6">
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{message}</p>
      </div>
    </main>
  )
}

function App() {
  const location = useLocation()
  const { articles, articlesBySection, sections, sectionsMetadata, subsectionsMetadata, sourceHealth, generatedAt, loading, error } = useArticles()
  const [searchOpen, setSearchOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [previewArticle, setPreviewArticle] = useState(null)
  const [currentSection, setCurrentSection] = useState(() => resolveVisualSection(location.pathname))
  const reduceMotion = usePrefersReducedMotion()
  const theme = useDocumentTheme()
  const startup = useStartupReveal({ loading, error })
  const hasArticles = articles.length > 0
  const hasResolvedData = !loading
  const pageState = error ? 'error' : hasResolvedData && !hasArticles ? 'empty' : 'ready'
  const meshSection = currentSection === 'home' ? 'tech' : currentSection

  useEffect(() => {
    setCurrentSection(resolveVisualSection(location.pathname))
  }, [location.pathname])

  useAccent(currentSection === 'home' ? null : currentSection)
  useCursorGlow(!startup.showOverlay)
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

  return (
    <div className="min-h-screen relative">
      <AtmosphereOrbs />
      <GradientMesh activeSection={meshSection} />
      <NeuralBackground
        activeSection={currentSection}
        searchOpen={startup.showOverlay ? false : searchOpen}
        mode={startup.showOverlay ? 'intro' : 'default'}
        intensity={startup.isIdleHold ? 'normal' : 'high'}
        veilActive={startup.showOverlay}
        meltActive={startup.phase === 'revealing'}
      />

      {startup.mountContent && (
        <div
          className={[
            'startup-content',
            startup.phase === 'revealing' ? 'startup-content--revealing' : 'startup-content--ready',
          ].join(' ')}
        >
          {pageState === 'ready' ? (
            <>
              <Routes>
                <Route
                  path="/"
                  element={
                    <HomePage
                      articles={articles}
                      articlesBySection={articlesBySection}
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
                      articlesBySection={articlesBySection}
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
            </>
          ) : (
            <FallbackState
              message={error || 'No articles found. Run the crawler first.'}
            />
          )}
        </div>
      )}

      {startup.showOverlay && (
        <StartupReveal
          phase={startup.phase}
          theme={theme}
          dataReady={hasResolvedData}
          reduceMotion={reduceMotion}
          onRevealComplete={startup.completeReveal}
        />
      )}
    </div>
  )
}

function HomePage({
  articles, articlesBySection, sections, sectionsMetadata, subsectionsMetadata,
  sourceHealth, generatedAt, onSearchOpen, onPreview,
  previewArticle, onClosePreview,
}) {
  return (
    <>
      <GlassNavbar
        sections={sections}
        activeSection={null}
        onSearchOpen={onSearchOpen}
      />

      <main className="max-w-7xl mx-auto px-4 pt-6 relative z-10">
        <HeroSection articlesBySection={articlesBySection} sectionsMetadata={sectionsMetadata} />
        <TrendingStrip articles={articles} subsectionsMetadata={subsectionsMetadata} />

        {previewArticle && (
          <PreviewPanel article={previewArticle} onClose={onClosePreview} />
        )}

        {sections.map(section => (
          <SectionShelf
            key={section.id}
            sectionId={section.id}
            meta={section}
            sectionArticles={articlesBySection[section.id] || []}
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
  articles, articlesBySection, sections, sectionsMetadata, subsectionsMetadata,
  sourceHealth, generatedAt, onSearchOpen, onPreview,
  previewArticle, onClosePreview, onHelpToggle,
  searchOpen, helpOpen,
}) {
  const { section } = useParams()
  const [searchParams] = useSearchParams()
  const meta = sectionsMetadata[section]
  const [focusedIndex, setFocusedIndex] = useState(-1)

  // Pre-partitioned from useArticles — no filter needed
  const sectionArticles = useMemo(
    () => articlesBySection[section] || [],
    [articles, section]
  )

  const {
    filtered, activeSubsection, setActiveSubsection,
    timeFilter, setTimeFilter, accessFilter, setAccessFilter,
    sortMode, setSortMode,
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
        <GlassNavbar sections={sections} activeSection={null} onSearchOpen={onSearchOpen} />
        <main className="max-w-5xl mx-auto px-4 pt-12 text-center">
          <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Section not found.</p>
        </main>
      </>
    )
  }

  return (
    <>
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
            <div className="w-px h-4" style={{ background: 'var(--glass-border)' }} />
            <div className="flex gap-1" role="group" aria-label="Sort order">
              {[
                { id: 'freshness', label: 'Newest' },
                { id: 'oldest', label: 'Oldest' },
                ...(section === 'research' ? [{ id: 'importance', label: 'Important' }] : []),
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setSortMode(mode.id)}
                  className={`glass-pill text-xs px-3 py-1 transition-all ${sortMode === mode.id ? 'active' : ''}`}
                  style={{ fontSize: '11px' }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
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
