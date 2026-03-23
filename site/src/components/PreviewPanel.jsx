import { X, ExternalLink } from 'lucide-react'
import { TierBadge, formatAge } from './ArticleCard'

export default function PreviewPanel({ article, onClose }) {
  if (!article) return null

  return (
    <div className="glass rounded-2xl p-5 mb-6 relative">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/15 transition-colors"
      >
        <X size={14} style={{ color: 'var(--text-tertiary)' }} />
      </button>

      <h2 className="font-medium pr-8 mb-3" style={{ fontSize: '17px', lineHeight: 1.35 }}>
        {article.title}
      </h2>

      {article.intro && (
        <p className="mb-4" style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          {article.intro}
        </p>
      )}

      {article.subsections?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {article.subsections.map(s => (
            <span
              key={s}
              className="font-mono px-2 py-0.5 rounded-full"
              style={{
                fontSize: '9.5px',
                background: 'var(--glass-bg-subtle)',
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
              }}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center flex-wrap gap-2 mb-4" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{article.source}</span>
        <TierBadge tier={article.tier} />
        <span>{formatAge(article.age_hours)}</span>
        {article.also_from?.length > 0 && (
          <span className="italic">
            Also from: {article.also_from.join(', ')}
          </span>
        )}
      </div>

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm text-white transition-all hover:scale-105"
        style={{
          background: 'var(--accent-tech)',
          transitionTimingFunction: 'var(--spring)',
        }}
      >
        Open on {article.source}
        <ExternalLink size={14} />
      </a>
    </div>
  )
}
