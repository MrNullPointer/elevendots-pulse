import { useRef, useEffect, useState, useMemo } from 'react'
import ArticleCard from './ArticleCard'
import { ScrollReveal } from '../hooks/useScrollReveal'

function useLazyCount(total, batchSize = 20) {
  const [count, setCount] = useState(batchSize)
  const sentinelRef = useRef(null)

  useEffect(() => { setCount(batchSize) }, [total, batchSize])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setCount(c => Math.min(c + batchSize, total)) },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [total, batchSize])

  return { count, sentinelRef }
}

export default function ArticleGrid({ articles, onPreview, focusedIndex = -1 }) {
  const { count, sentinelRef } = useLazyCount(articles.length)
  const visible = useMemo(() => articles.slice(0, count), [articles, count])

  if (articles.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--text-tertiary)', fontSize: '13px' }} role="status">
        No articles match your filters.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3" role="feed" aria-label="Article list">
      {visible.map((article, i) => (
        <ScrollReveal key={article.id} delay={Math.min(i * 40, 200)}>
          <ArticleCard
            id={`article-${i}`}
            article={article}
            onPreview={onPreview}
            isFocused={focusedIndex === i}
          />
        </ScrollReveal>
      ))}
      {count < articles.length && (
        <div ref={sentinelRef} className="h-4" aria-hidden="true" />
      )}
    </div>
  )
}
