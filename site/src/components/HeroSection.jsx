import { ExternalLink } from 'lucide-react'
import { TierBadge, formatAge } from './ArticleCard'
import { liveAgeHours } from '../hooks/useArticles'
import { ScrollReveal } from '../hooks/useScrollReveal'

function FeaturedCard({ article, section, accentColor }) {
  if (!article) return null

  return (
    <article>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="card-solid block p-5 group transition-all"
        style={{ transitionTimingFunction: 'var(--spring)' }}
        aria-label={`Featured: ${article.title}`}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full" style={{ background: accentColor }} aria-hidden="true" />
          <span className="font-mono uppercase" style={{ fontSize: '9.5px', letterSpacing: '0.5px', color: accentColor }}>
            Featured in {section}
          </span>
        </div>
        <h2 className="font-medium mb-2 pr-4" style={{ fontSize: '16px', lineHeight: 1.35, fontWeight: 500 }}>
          {article.title}
        </h2>
        {article.intro && (
          <p className="line-clamp-2 mb-3" style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
            {article.intro}
          </p>
        )}
        <div className="flex items-center gap-2" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{article.source}</span>
          <TierBadge tier={article.tier} />
          <span>{formatAge(liveAgeHours(article))}</span>
          <ExternalLink size={11} className="ml-auto opacity-0 group-hover:opacity-40 transition-opacity" aria-hidden="true" />
        </div>
      </a>
    </article>
  )
}

export default function HeroSection({ articlesBySection, sectionsMetadata }) {
  // Already sorted by (confidence, published_at DESC) — just take first
  const techFeatured = articlesBySection?.tech?.[0] || null
  const scienceFeatured = articlesBySection?.science?.[0] || null

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 animate-hero" aria-label="Featured stories">
      <ScrollReveal>
        <FeaturedCard
          article={techFeatured}
          section="Tech"
          accentColor={sectionsMetadata?.tech?.theme_color || 'var(--accent-tech)'}
        />
      </ScrollReveal>
      <ScrollReveal delay={100}>
        <FeaturedCard
          article={scienceFeatured}
          section="Science"
          accentColor={sectionsMetadata?.science?.theme_color || 'var(--accent-science)'}
        />
      </ScrollReveal>
    </section>
  )
}
