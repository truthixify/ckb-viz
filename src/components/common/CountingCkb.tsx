import { useCountUp } from '@/app/motion'
import { formatCkb } from '@/domain/units'

/**
 * A CKB amount that counts up to its value on mount. Renders just the formatted
 * number (no unit) so the caller controls styling and the "CKB" suffix.
 */
export function CountingCkb({
  value,
  duration,
  delay,
}: {
  value: bigint
  duration?: number
  delay?: number
}) {
  const current = useCountUp(value, duration, delay)
  return <>{formatCkb(current)}</>
}
