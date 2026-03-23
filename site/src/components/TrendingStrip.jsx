import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ScrollReveal } from '../hooks/useScrollReveal'

function detectClusters(articles) {
  const recentArticles = articles.filter(a => a.age_hours <= 12)
  const wordCounts = {}

  for (const a of recentArticles) {
    const words = a.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/).filter(w => w.length > 3)
    const unique = [...new Set(words)]
    for (const w of unique) {
      if (!wordCounts[w]) wordCounts[w] = { count: 0, articles: [] }
      wordCounts[w].count++
      wordCounts[w].articles.push(a.id)
    }
  }

  const stopWords = new Set(['this', 'that', 'with', 'from', 'have', 'been',
    'will', 'more', 'than', 'into', 'also', 'just', 'what', 'they', 'their',
    'about', 'could', 'would', 'first', 'after', 'over', 'says', 'said',
    'year', 'years', 'make', 'made', 'some', 'most', 'very', 'when', 'where',
    'which', 'while', 'being', 'here', 'there', 'these', 'those', 'other',
    'each', 'every', 'both', 'does', 'doing', 'done', 'were', 'your'])

  return Object.entries(wordCounts)
    .filter(([word, data]) => data.count >= 3 && !stopWords.has(word))
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 4)
    .map(([word, data]) => ({ label: word.charAt(0).toUpperCase() + word.slice(1), count: data.count, type: 'cluster' }))
}

export default function TrendingStrip({ articles, subsectionsMetadata }) {
  const navigate = useNavigate()

  const { subsectionTopics, clusterTopics } = useMemo(() => {
    const recentArticles = articles.filter(a => a.age_hours <= 12)
    const counts = {}
    for (const a of recentArticles) {
      for (const sub of a.subsections || []) { counts[sub] = (counts[sub] || 0) + 1 }
    }
    const subsectionTopics = Object.entries(counts)
      .sort(([, a], [, b]) => b - a).slice(0, 8)
      .map(([sub, count]) => ({
        id: sub, label: subsectionsMetadata[sub]?.display_name || sub,
        section: subsectionsMetadata[sub]?.section || 'tech', count, type: 'subsection',
      }))
    return { subsectionTopics, clusterTopics: detectClusters(articles) }
  }, [articles, subsectionsMetadata])

  const allTopics = [...subsectionTopics, ...clusterTopics]
  if (allTopics.length === 0) return null

  return (
    <ScrollReveal>
      <section className="glass rounded-2xl px-4 py-2.5 mb-6 flex items-center gap-3 overflow-x-auto no-scrollbar" aria-label="Trending topics">
        <div className="flex items-center gap-1.5 shrink-0" style={{ color: 'var(--text-tertiary)' }}>
          <TrendingUp size={14} aria-hidden="true" />
          <span className="font-mono uppercase" style={{ fontSize: '9px', letterSpacing: '0.5px' }}>Trending</span>
        </div>
        <div className="flex gap-1.5 stagger-children">
          {allTopics.map(topic => (
            <button
              key={topic.id || topic.label}
              onClick={() => { if (topic.type === 'subsection') navigate(`/${topic.section}?sub=${topic.id}`) }}
              className="glass-pill rounded-full whitespace-nowrap flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
              style={{ fontSize: '11px', cursor: topic.type === 'subsection' ? 'pointer' : 'default' }}
              aria-label={`${topic.label}: ${topic.count} articles`}
            >
              {topic.type === 'cluster' && <span style={{ color: 'var(--accent-tech)', fontSize: '10px' }}>#</span>}
              <span className="font-medium">{topic.label}</span>
              <span className="font-mono opacity-50" style={{ fontSize: '9px' }}>{topic.count}</span>
            </button>
          ))}
        </div>
      </section>
    </ScrollReveal>
  )
}
