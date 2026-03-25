import { useCallback, useEffect, useRef, useState } from 'react'

export const STARTUP_MIN_DURATION_MS = 2000
export const STARTUP_REVEAL_DURATION_MS = 800

/**
 * Startup reveal state machine.
 *
 * Phases: intro → holding (if data slow) → revealing → done
 *
 * - Overlay stays for at least minDurationMs (2s default)
 * - If data arrives before 2s, waits, then reveals
 * - If data is slow, enters idle-hold until ready
 * - Reveal animation runs for revealDurationMs (800ms default)
 * - After reveal, overlay unmounts permanently
 */
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

  // completeReveal MUST be defined before startReveal to avoid
  // temporal dead zone with useCallback dependency arrays.
  const completeReveal = useCallback(() => {
    if (revealCompletedRef.current) return
    revealCompletedRef.current = true
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
    }
    setPhase('done')
  }, [])

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

  // Keep loading ref in sync for timeout callback
  useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  // Minimum duration timer — fires once at mount + minDurationMs
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

  // Trigger reveal when data arrives after minimum elapsed
  useEffect(() => {
    if (!minimumElapsed || loading) return undefined
    startReveal()
    return undefined
  }, [loading, minimumElapsed, startReveal])

  // Handle error states — reveal into the error UI
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
