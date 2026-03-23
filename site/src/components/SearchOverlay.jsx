import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Fuse from 'fuse.js'
import { Search, X, ExternalLink } from 'lucide-react'
import { TierBadge, formatAge, computeAge } from './ArticleCard'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

const SECTION_COLORS = {
  tech: 'var(--accent-tech)',
  science: 'var(--accent-science)',
  philosophy: 'var(--accent-philosophy)',
  misc: 'var(--accent-misc)',
}

export default function SearchOverlay({ articles, isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const resultsRef = useRef(null)
  const debouncedQuery = useDebounce(query, 300)

  const fuse = useMemo(() => new Fuse(articles, {
    keys: [
      { name: 'title', weight: 0.6 },
      { name: 'intro', weight: 0.25 },
      { name: 'source', weight: 0.1 },
      { name: 'subsections', weight: 0.05 },
    ],
    threshold: 0.35,
    includeScore: true,
  }), [articles])

  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    return fuse.search(debouncedQuery).slice(0, 10).map(r => r.item)
  }, [fuse, debouncedQuery])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  const scrollSelectedIntoView = useCallback((index) => {
    const container = resultsRef.current
    if (!container) return
    const item = container.children[index]
    if (item) item.scrollIntoView({ block: 'nearest' })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => {
          const next = Math.min(i + 1, results.length - 1)
          scrollSelectedIntoView(next)
          return next
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => {
          const next = Math.max(i - 1, 0)
          scrollSelectedIntoView(next)
          return next
        })
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        window.open(results[selectedIndex].url, '_blank', 'noopener,noreferrer')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, results, selectedIndex, onClose, scrollSelectedIntoView])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Search articles"
    >
      <div className="fixed inset-0" style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />

      <div
        className="glass relative w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '0.5px solid var(--glass-border)' }}>
          <Search size={16} style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search articles..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
            aria-label="Search query"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ background: 'transparent' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            aria-label="Close search"
          >
            <X size={14} style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        {results.length > 0 && (
          <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto py-1" role="listbox">
            {results.map((article, i) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                role="option"
                aria-selected={i === selectedIndex}
                className="block px-4 py-2.5 transition-colors"
                style={{
                  background: i === selectedIndex ? 'var(--glass-hover)' : 'transparent',
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{article.title}</div>
                    <div className="flex items-center gap-2 mt-0.5" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: SECTION_COLORS[article.section] || 'var(--text-tertiary)' }}
                      />
                      <span>{article.source}</span>
                      <span className="font-mono uppercase" style={{ fontSize: '9px', color: SECTION_COLORS[article.section] }}>
                        {article.section}
                      </span>
                      <TierBadge tier={article.tier} />
                      <span>{formatAge(computeAge(article))}</span>
                    </div>
                  </div>
                  <ExternalLink size={12} className="shrink-0 mt-1 opacity-30" aria-hidden="true" />
                </div>
              </a>
            ))}
          </div>
        )}

        {debouncedQuery.trim() && results.length === 0 && (
          <div className="px-4 py-8 text-center" style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            No results for "{debouncedQuery}"
          </div>
        )}

        <div className="px-4 py-2 flex items-center gap-3" style={{ borderTop: '0.5px solid var(--glass-border)', fontSize: '10px', color: 'var(--text-tertiary)' }}>
          <span className="kbd">↑</span><span className="kbd">↓</span> navigate
          <span className="kbd">↵</span> open
          <span className="kbd">esc</span> close
        </div>
      </div>
    </div>
  )
}
