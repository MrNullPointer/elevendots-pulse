import { useState, useMemo } from 'react'

export function useFilters(articles) {
  const [activeSubsection, setActiveSubsection] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')
  const [accessFilter, setAccessFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    let result = articles

    if (activeSubsection !== 'all') {
      result = result.filter(a => a.subsections?.includes(activeSubsection))
    }

    if (timeFilter !== 'all') {
      const hours = Number(timeFilter)
      result = result.filter(a => a.age_hours <= hours)
    }

    if (accessFilter !== 'all') {
      if (accessFilter === 'free') {
        result = result.filter(a => a.tier === 'free')
      } else if (accessFilter === 'paid') {
        result = result.filter(a => a.tier === 'paid' || a.tier === 'freemium')
      }
    }

    return result.sort((a, b) => a.age_hours - b.age_hours)
  }, [articles, activeSubsection, timeFilter, accessFilter])

  return {
    filtered,
    activeSubsection, setActiveSubsection,
    timeFilter, setTimeFilter,
    accessFilter, setAccessFilter,
    searchQuery, setSearchQuery,
  }
}
