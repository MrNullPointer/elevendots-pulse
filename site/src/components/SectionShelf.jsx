import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import ArticleCard from './ArticleCard'

export default function SectionShelf({ sectionId, meta, articles, onPreview }) {
  const navigate = useNavigate()

  const sectionArticles = articles
    .filter(a => a.section === sectionId)
    .sort((a, b) => a.age_hours - b.age_hours)

  const displayed = sectionArticles.slice(0, 3)
  const total = sectionArticles.length

  if (displayed.length === 0) return null

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: meta.theme_color || '#666' }}
          />
          <h2 className="font-medium" style={{ fontSize: '15px' }}>
            {meta.display_name}
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            {meta.description}
          </span>
        </div>

        <button
          onClick={() => navigate(`/${sectionId}`)}
          className="flex items-center gap-0.5 text-xs font-medium shrink-0 transition-all hover:gap-1.5"
          style={{
            color: meta.theme_color || 'var(--text-secondary)',
            transitionTimingFunction: 'var(--spring)',
          }}
        >
          See all {total}
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {displayed.map(article => (
          <ArticleCard key={article.id} article={article} onPreview={onPreview} />
        ))}
      </div>

      <div className="md:hidden flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {/* Mobile: cards are already in the grid above with single column */}
      </div>
    </section>
  )
}
