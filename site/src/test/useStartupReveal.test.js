import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStartupReveal } from '../hooks/useStartupReveal'

describe('useStartupReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('reveals after the minimum intro duration for fast success', async () => {
    const { result, rerender } = renderHook(
      ({ loading, error }) => useStartupReveal({ loading, error }),
      { initialProps: { loading: true, error: null } }
    )

    rerender({ loading: false, error: null })
    expect(result.current.phase).toBe('intro')
    expect(result.current.mountContent).toBe(false)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2001)
    })

    expect(result.current.mountContent).toBe(true)
    expect(result.current.phase).toBe('revealing')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900)
    })

    expect(result.current.phase).toBe('done')
    expect(result.current.showOverlay).toBe(false)
  })

  it('enters holding when loading continues past the intro window', async () => {
    const { result, rerender } = renderHook(
      ({ loading, error }) => useStartupReveal({ loading, error }),
      { initialProps: { loading: true, error: null } }
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2001)
    })

    expect(result.current.phase).toBe('holding')
    expect(result.current.isIdleHold).toBe(true)

    rerender({ loading: false, error: null })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900)
    })

    expect(result.current.phase).toBe('done')
  })

  it('reveals error states after the intro minimum', async () => {
    const { result, rerender } = renderHook(
      ({ loading, error }) => useStartupReveal({ loading, error }),
      { initialProps: { loading: true, error: null } }
    )

    rerender({ loading: false, error: 'HTTP 500' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2001)
    })

    expect(result.current.mountContent).toBe(true)
    expect(result.current.phase).toBe('revealing')
  })

  it('prevents re-entry after the reveal completes', async () => {
    const { result, rerender } = renderHook(
      ({ loading, error }) => useStartupReveal({ loading, error }),
      { initialProps: { loading: false, error: null } }
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3001)
    })

    expect(result.current.phase).toBe('done')

    rerender({ loading: true, error: null })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(result.current.phase).toBe('done')
    expect(result.current.showOverlay).toBe(false)
  })
})
