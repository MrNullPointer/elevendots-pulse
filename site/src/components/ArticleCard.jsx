import { ExternalLink, Lock } from 'lucide-react'

function formatAge(hours) {
  if (hours < 0) return 'just now'
  if (hours < 1) return `${Math.round(hours * 60)}m ago`
  if (hours < 24) return `${Math.round(hours)}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function TierBadge({ tier }) {
  const cls = `badge-${tier}`
  return (
    <span
      className={`${cls} inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono`}
      style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}
    >
      {tier === 'paid' && <Lock size={8} />}
      {tier}
    </span>
  )
}

export default function ArticleCard({ article, compact = false, onPreview }) {
  const handleClick = (e) => {
    if (e.altKey && onPreview) {
      e.preventDefault()
      onPreview(article)
    }
  }

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="card-solid block p-3.5 transition-all group"
      style={{ transitionTimingFunction: 'var(--spring)' }}
    >
      <h3
        className="font-medium leading-snug mb-1"
        style={{ fontSize: '14px', lineHeight: 1.4 }}
      >
        {article.title}
      </h3>

      {article.intro && !compact && (
        <p
          className="line-clamp-2 mb-2"
          style={{ fontSize: '12.5px', lineHeight: 1.55, color: 'var(--text-secondary)' }}
        >
          {article.intro}
        </p>
      )}

      <div className="flex items-center flex-wrap gap-x-2 gap-y-1" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{article.source}</span>
        <TierBadge tier={article.tier} />
        <span>{formatAge(article.age_hours)}</span>

        {article.subsections?.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {article.subsections.slice(0, 3).map(s => (
              <span
                key={s}
                className="font-mono px-1.5 py-0.5 rounded"
                style={{
                  fontSize: '9px',
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

        {article.also_from?.length > 0 && (
          <span className="italic opacity-70">+{article.also_from.length} source{article.also_from.length > 1 ? 's' : ''}</span>
        )}

        <ExternalLink
          size={11}
          className="ml-auto opacity-0 group-hover:opacity-50 transition-opacity"
        />
      </div>
    </a>
  )
}

export { TierBadge, formatAge }
