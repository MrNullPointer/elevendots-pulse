import { useState, useEffect, useMemo } from 'react'

/**
 * Master sort comparator.
 *
 * Uses the crawler's pre-computed freshness_score when available.
 * freshness_score encodes: bucket (coarse) → confidence → age (fine).
 * Lower score = fresher article.
 *
 * Falls back to published_at descending for articles without freshness
 * metadata (should not happen with the current pipeline, but defensive).
 */
function articleComparator(a, b) {
  const scoreA = a.freshness_score
  const scoreB = b.freshness_score

  // Both have freshness_score — use it directly (lower = fresher = first)
  if (scoreA != null && scoreB != null) {
    if (scoreA !== scoreB) return scoreA - scoreB
    // Tiebreak: newer published_at first
    return (b.published_at || 0) - (a.published_at || 0)
  }

  // Fallback: articles with freshness_score sort before those without
  if (scoreA != null) return -1
  if (scoreB != null) return 1

  // Neither has freshness_score: sort by published_at descending
  return (b.published_at || 0) - (a.published_at || 0)
}

/**
 * Compute live age in hours from epoch-ms published_at.
 * All components should use this instead of article.age_hours.
 *
 * Low-confidence articles (missing/invalid dates) return Infinity
 * so they are excluded from time-based filters and display as
 * "Date unknown" rather than a misleading "0m ago".
 */
export function liveAgeHours(article) {
  const conf = article.published_confidence || article.date_confidence
  if (conf === 'low' || conf === 'unknown') {
    // No trustworthy timestamp — return Infinity so time filters exclude them
    return Infinity
  }
  if (article.published_at) {
    return Math.max(0, (Date.now() - article.published_at) / 3600000)
  }
  // Fallback for articles without published_at but with known confidence
  return article.age_hours ?? Infinity
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
