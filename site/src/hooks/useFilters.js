import { useState, useMemo } from 'react'
import { liveAgeHours } from './useArticles'

export function useFilters(articles) {
  const [activeSubsection, setActiveSubsection] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')
  const [accessFilter, setAccessFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    let result = articles // already sorted from useArticles

    if (activeSubsection !== 'all') {
      result = result.filter(a => a.subsections?.includes(activeSubsection))
    }

    if (timeFilter !== 'all') {
      const hours = Number(timeFilter)
      // LIVE age check — not the stale age_hours snapshot
      result = result.filter(a => liveAgeHours(a) <= hours)
    }

    if (accessFilter !== 'all') {
      if (accessFilter === 'free') {
        result = result.filter(a => a.tier === 'free')
      } else if (accessFilter === 'paid') {
        result = result.filter(a => a.tier === 'paid' || a.tier === 'freemium')
      }
    }

    // NO RE-SORT — input was pre-sorted, filter preserves order
    return result
  }, [articles, activeSubsection, timeFilter, accessFilter])

  return {
    filtered,
    activeSubsection, setActiveSubsection,
    timeFilter, setTimeFilter,
    accessFilter, setAccessFilter,
    searchQuery, setSearchQuery,
  }
}
