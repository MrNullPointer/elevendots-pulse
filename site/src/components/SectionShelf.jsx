import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import ArticleCard from './ArticleCard'
import { ScrollReveal } from '../hooks/useScrollReveal'

export default function SectionShelf({ sectionId, meta, articles, onPreview }) {
  const navigate = useNavigate()

  const { displayed, total } = useMemo(() => {
    const sectionArticles = articles
      .filter(a => a.section === sectionId)
      .sort((a, b) => a.age_hours - b.age_hours)
    return { displayed: sectionArticles.slice(0, 3), total: sectionArticles.length }
  }, [articles, sectionId])

  if (displayed.length === 0) return null

  return (
    <ScrollReveal as="section" className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.theme_color || '#666' }} aria-hidden="true" />
          <h2 className="font-medium" style={{ fontSize: '15px' }}>{meta.display_name}</h2>
          <span className="hidden sm:inline" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{meta.description}</span>
        </div>
        <button
          onClick={() => navigate(`/${sectionId}`)}
          className="flex items-center gap-0.5 text-xs font-medium shrink-0 transition-all hover:gap-1.5"
          style={{ color: meta.theme_color || 'var(--text-secondary)', transitionTimingFunction: 'var(--spring)' }}
          aria-label={`See all ${total} articles in ${meta.display_name}`}
        >
          See all {total}
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 scroll-reveal-stagger">
        {displayed.map((article, i) => (
          <ScrollReveal key={article.id} delay={i * 80}>
            <ArticleCard article={article} onPreview={onPreview} />
          </ScrollReveal>
        ))}
      </div>
    </ScrollReveal>
  )
}
