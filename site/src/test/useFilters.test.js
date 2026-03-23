import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFilters } from '../hooks/useFilters'
import { mockArticles } from './fixtures'

describe('useFilters', () => {
  it('returns all articles when no filters active', () => {
    const { result } = renderHook(() => useFilters(mockArticles))
    expect(result.current.filtered).toHaveLength(mockArticles.length)
  })

  it('sorts articles by age_hours ascending (freshest first)', () => {
    const { result } = renderHook(() => useFilters(mockArticles))
    const ages = result.current.filtered.map(a => a.age_hours)
    for (let i = 1; i < ages.length; i++) {
      expect(ages[i]).toBeGreaterThanOrEqual(ages[i - 1])
    }
  })

  it('filters by subsection', () => {
    const { result } = renderHook(() => useFilters(mockArticles))
    act(() => result.current.setActiveSubsection('semiconductor'))
    expect(result.current.filtered.every(a => a.subsections.includes('semiconductor'))).toBe(true)
    expect(result.current.filtered.length).toBe(2) // art-1 and art-4
  })

  it('filters by time (articles within N hours)', () => {
    const { result } = renderHook(() => useFilters(mockArticles))
    act(() => result.current.setTimeFilter('6'))
    expect(result.current.filtered.every(a => a.age_hours <= 6)).toBe(true)
  })

  it('filters by access: free', () => {
    const { result } = renderHook(() => useFilters(mockArticles))
    act(() => result.current.setAccessFilter('free'))
    expect(result.current.filtered.every(a => a.tier === 'free')).toBe(true)
  })

  it('filters by access: paid (includes freemium)', () => {
    const { result } = renderHook(() => useFilters(mockArticles))
    act(() => result.current.setAccessFilter('paid'))
    expect(result.current.filtered.every(a => a.tier === 'paid' || a.tier === 'freemium')).toBe(true)
  })

  it('combines multiple filters', () => {
    const { result } = renderHook(() => useFilters(mockArticles))
    act(() => {
      result.current.setActiveSubsection('semiconductor')
      result.current.setTimeFilter('6')
    })
    expect(result.current.filtered.length).toBe(1) // only art-1 (1h old, semiconductor)
    expect(result.current.filtered[0].id).toBe('art-1')
  })

  it('returns empty when no articles match', () => {
    const { result } = renderHook(() => useFilters(mockArticles))
    act(() => {
      result.current.setActiveSubsection('nonexistent')
    })
    expect(result.current.filtered).toHaveLength(0)
  })

  it('resets to all when subsection set back to "all"', () => {
    const { result } = renderHook(() => useFilters(mockArticles))
    act(() => result.current.setActiveSubsection('semiconductor'))
    expect(result.current.filtered.length).toBe(2)
    act(() => result.current.setActiveSubsection('all'))
    expect(result.current.filtered.length).toBe(mockArticles.length)
  })
})
