import { useCallback, useEffect, useRef, useState } from 'react'

export const STARTUP_MIN_DURATION_MS = 2000
export const STARTUP_REVEAL_DURATION_MS = 800

export function useStartupReveal({
  loading,
  error,
  minDurationMs = STARTUP_MIN_DURATION_MS,
  revealDurationMs = STARTUP_REVEAL_DURATION_MS,
}) {
  const [phase, setPhase] = useState('intro')
  const [mountContent, setMountContent] = useState(false)
  const [minimumElapsed, setMinimumElapsed] = useState(false)
  const loadingRef = useRef(loading)
  const revealStartedRef = useRef(false)
  const revealCompletedRef = useRef(false)
  const revealTimerRef = useRef(null)

  const startReveal = useCallback(() => {
    if (revealStartedRef.current || revealCompletedRef.current) return

    revealStartedRef.current = true
    setMountContent(true)
    setPhase('revealing')

    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current)
    revealTimerRef.current = window.setTimeout(() => {
      completeReveal()
    }, revealDurationMs)
  }, [completeReveal, revealDurationMs])

  const completeReveal = useCallback(() => {
    if (revealCompletedRef.current) return
    revealCompletedRef.current = true
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
    }
    setPhase('done')
  }, [])

  useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMinimumElapsed(true)

      if (loadingRef.current) {
        setPhase('holding')
        return
      }

      startReveal()
    }, minDurationMs)

    return () => {
      window.clearTimeout(timer)
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current)
    }
  }, [minDurationMs, startReveal])

  useEffect(() => {
    if (!minimumElapsed || loading) return undefined
    startReveal()
    return undefined
  }, [loading, minimumElapsed, startReveal])

  useEffect(() => {
    if (error && minimumElapsed && !revealStartedRef.current) {
      startReveal()
    }
  }, [error, minimumElapsed, startReveal])

  return {
    phase,
    showOverlay: phase !== 'done',
    mountContent: mountContent || phase === 'done',
    isIdleHold: phase === 'holding',
    completeReveal,
  }
}
