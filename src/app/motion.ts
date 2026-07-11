import { useEffect, useState } from 'react'

/** Tracks the user's reduced-motion preference, reactively. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** A clock that re-renders on an interval, to keep relative times fresh. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/**
 * Count a bigint value up from zero on mount (easeOutCubic), so a capacity or
 * fee reaches its end state rather than snapping in. Instant under reduced
 * motion. Values are shannons; Number() is exact well past any real capacity.
 */
export function useCountUp(target: bigint, duration = 750, delay = 0): bigint {
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState<bigint>(reduced ? target : 0n)

  useEffect(() => {
    if (reduced) {
      setValue(target)
      return
    }
    const targetNum = Number(target)
    let raf = 0
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      const elapsed = now - start - delay
      if (elapsed <= 0) {
        raf = requestAnimationFrame(tick)
        return
      }
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(t >= 1 ? target : BigInt(Math.round(targetNum * eased)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced, duration, delay])

  return value
}
