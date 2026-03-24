import { useState, useEffect, useMemo } from 'react'

// Confidence tier for sort: exact (0) < estimated (1) < unknown (2)
const CONF_RANK = { exact: 0, estimated: 1, unknown: 2 }

/**
 * Master sort comparator.
 * Primary key: date confidence tier (real dates before unknown).
 * Secondary key: published_at descending (newest first).
 */
function articleComparator(a, b) {
  const confA = CONF_RANK[a.date_confidence] ?? 2
  const confB = CONF_RANK[b.date_confidence] ?? 2
  if (confA !== confB) return confA - confB
  return (b.published_at || 0) - (a.published_at || 0)
}

/**
 * Compute live age in hours from epoch-ms timestamp.
 * All components should use this instead of article.age_hours.
 */
export function liveAgeHours(article) {
  if (article.published_at && article.date_confidence !== 'unknown') {
    return Math.max(0, (Date.now() - article.published_at) / 3600000)
  }
  // Unknown dates or missing published_at: use crawler's age_hours as fallback
  return article.age_hours ?? 0
}

export function useArticles() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Cache-bust every 5 minutes
    const v = Math.floor(Date.now() / (5 * 60000))
    fetch(`${import.meta.env.BASE_URL}articles.json?v=${v}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  // Sort ONCE, partition ONCE
  const processed = useMemo(() => {
    if (!data) return null
    const articles = data.articles || []

    // Single master sort
    const sorted = [...articles].sort(articleComparator)

    // Pre-partition by section
    const bySection = {}
    for (const article of sorted) {
      const s = article.section
      if (!bySection[s]) bySection[s] = []
      bySection[s].push(article)
    }

    return { sorted, bySection }
  }, [data])

  const sectionsMetadata = data?.sections_metadata || {}
  const subsectionsMetadata = data?.subsections_metadata || {}
  const sourceHealth = data?.source_health || []
  const generatedAt = data?.generated_at || null
  const articleCount = data?.article_count || 0

  const sections = useMemo(() =>
    Object.entries(sectionsMetadata)
      .sort(([, a], [, b]) => (a.order || 99) - (b.order || 99))
      .map(([id, meta]) => ({ id, ...meta })),
    [sectionsMetadata]
  )

  const subsectionsBySection = useMemo(() => {
    const map = {}
    for (const [id, meta] of Object.entries(subsectionsMetadata)) {
      if (!map[meta.section]) map[meta.section] = []
      map[meta.section].push({ id, ...meta })
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.order || 99) - (b.order || 99))
    }
    return map
  }, [subsectionsMetadata])

  return {
    articles: processed?.sorted || [],
    articlesBySection: processed?.bySection || {},
    sections,
    sectionsMetadata,
    subsectionsMetadata,
    subsectionsBySection,
    sourceHealth,
    generatedAt,
    articleCount,
    loading,
    error,
  }
}
