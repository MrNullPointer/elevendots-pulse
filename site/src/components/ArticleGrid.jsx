import ArticleCard from './ArticleCard'

export default function ArticleGrid({ articles, onPreview }) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
        No articles match your filters.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {articles.map(article => (
        <ArticleCard key={article.id} article={article} onPreview={onPreview} />
      ))}
    </div>
  )
}
