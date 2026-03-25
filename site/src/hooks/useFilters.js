import { useState, useMemo } from 'react'
import { liveAgeHours } from './useArticles'

export function useFilters(articles) {
  const [activeSubsection, setActiveSubsection] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')
  const [accessFilter, setAccessFilter] = useState('all')
  const [sortMode, setSortMode] = useState('freshness') // 'freshness' | 'importance' | 'oldest'
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    let result = articles // already sorted from useArticles (by freshness, newest first)

    if (activeSubsection !== 'all') {
      result = result.filter(a => a.subsections?.includes(activeSubsection))
    }

    if (timeFilter !== 'all') {
      const hours = Number(timeFilter)
      result = result.filter(a => liveAgeHours(a) <= hours)
    }

    if (accessFilter !== 'all') {
      if (accessFilter === 'free') {
        result = result.filter(a => a.tier === 'free')
      } else if (accessFilter === 'paid') {
        result = result.filter(a => a.tier === 'paid' || a.tier === 'freemium')
      }
    }

    // Apply sort mode
    if (sortMode === 'oldest') {
      // Reverse the default freshness order (oldest first)
      // Create a new array to avoid mutating the source
      result = [...result].reverse()
    } else if (sortMode === 'importance') {
      // Research section: Must Read first, then Frontier, then freshness
      result = [...result].sort((a, b) => {
        const aMustRead = a.subsections?.includes('r-must-read') ? 0 : 1
        const bMustRead = b.subsections?.includes('r-must-read') ? 0 : 1
        if (aMustRead !== bMustRead) return aMustRead - bMustRead

        const aFrontier = a.subsections?.includes('r-frontier') ? 0 : 1
        const bFrontier = b.subsections?.includes('r-frontier') ? 0 : 1
        if (aFrontier !== bFrontier) return aFrontier - bFrontier

        return (a.freshness_score || 0) - (b.freshness_score || 0)
      })
    }
    // Default 'freshness': input was pre-sorted newest-first, filter preserves order

    return result
  }, [articles, activeSubsection, timeFilter, accessFilter, sortMode])

  return {
    filtered,
    activeSubsection, setActiveSubsection,
    timeFilter, setTimeFilter,
    accessFilter, setAccessFilter,
    sortMode, setSortMode,
    searchQuery, setSearchQuery,
  }
}
