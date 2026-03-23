import { useState, useEffect, useRef, useMemo } from 'react'
import Fuse from 'fuse.js'
import { Search, X, ExternalLink } from 'lucide-react'
import { TierBadge, formatAge } from './ArticleCard'

export default function SearchOverlay({ articles, isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

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
    if (!query.trim()) return []
    return fuse.search(query).slice(0, 12).map(r => r.item)
  }, [fuse, query])

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

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        window.open(results[selectedIndex].url, '_blank', 'noopener,noreferrer')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, results, selectedIndex, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />

      <div
        className="glass relative w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--glass-border)' }}>
          <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search articles..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10">
            <X size={14} style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        {results.length > 0 && (
          <div className="max-h-[50vh] overflow-y-auto py-1">
            {results.map((article, i) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block px-4 py-2.5 transition-colors ${
                  i === selectedIndex ? 'bg-white/15' : 'hover:bg-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{article.title}</div>
                    <div className="flex items-center gap-2 mt-0.5" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      <span>{article.source}</span>
                      <TierBadge tier={article.tier} />
                      <span>{formatAge(article.age_hours)}</span>
                    </div>
                  </div>
                  <ExternalLink size={12} className="shrink-0 mt-1 opacity-30" />
                </div>
              </a>
            ))}
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <div className="px-4 py-8 text-center" style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            No results for "{query}"
          </div>
        )}

        <div className="px-4 py-2 border-t flex items-center gap-3" style={{ borderColor: 'var(--glass-border)', fontSize: '10px', color: 'var(--text-tertiary)' }}>
          <span className="font-mono">↑↓</span> navigate
          <span className="font-mono">↵</span> open
          <span className="font-mono">esc</span> close
        </div>
      </div>
    </div>
  )
}
