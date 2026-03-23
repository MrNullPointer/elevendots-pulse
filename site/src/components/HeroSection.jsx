import { ExternalLink } from 'lucide-react'
import { TierBadge, formatAge } from './ArticleCard'

function FeaturedCard({ article, section, accentColor }) {
  if (!article) return null

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card-solid block p-5 group transition-all"
      style={{ transitionTimingFunction: 'var(--spring)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: accentColor }}
        />
        <span
          className="font-mono uppercase"
          style={{ fontSize: '9.5px', letterSpacing: '0.5px', color: accentColor }}
        >
          Featured in {section}
        </span>
      </div>

      <h2
        className="font-medium mb-2"
        style={{ fontSize: '16px', lineHeight: 1.35, fontWeight: 500 }}
      >
        {article.title}
      </h2>

      {article.intro && (
        <p
          className="line-clamp-2 mb-3"
          style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--text-secondary)' }}
        >
          {article.intro}
        </p>
      )}

      <div className="flex items-center gap-2" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{article.source}</span>
        <TierBadge tier={article.tier} />
        <span>{formatAge(article.age_hours)}</span>
        <ExternalLink size={11} className="ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
      </div>
    </a>
  )
}

export default function HeroSection({ articles, sectionsMetadata }) {
  const techArticles = articles
    .filter(a => a.section === 'tech')
    .sort((a, b) => a.age_hours - b.age_hours)
  const scienceArticles = articles
    .filter(a => a.section === 'science')
    .sort((a, b) => a.age_hours - b.age_hours)

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
      <FeaturedCard
        article={techArticles[0]}
        section="Tech"
        accentColor={sectionsMetadata?.tech?.theme_color || 'var(--accent-tech)'}
      />
      <FeaturedCard
        article={scienceArticles[0]}
        section="Science"
        accentColor={sectionsMetadata?.science?.theme_color || 'var(--accent-science)'}
      />
    </section>
  )
}
