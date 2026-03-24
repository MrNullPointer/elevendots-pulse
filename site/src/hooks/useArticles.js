import { useState, useEffect, useMemo } from 'react'

export function useArticles() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}articles.json`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  const articles = data?.articles || []
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
    articles,
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
