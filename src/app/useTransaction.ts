import { useQuery } from '@tanstack/react-query'
import { enrichTransaction, type EnrichedTransaction } from '@/decode/enrich'
import { VizError, isVizError } from '@/domain/errors'
import { isValidTxHash } from '@/domain/units'
import type { ScriptRegistry } from '@/registry/registry'
import type { TransactionSource } from '@/source/TransactionSource'

/**
 * Load and enrich a transaction by hash. A committed transaction is immutable,
 * so the result is cached indefinitely by (network, hash). Deterministic
 * failures (bad hash, not found, RPC error) are surfaced as VizError and never
 * retried; only transient network errors retry.
 */
export function useTransaction(
  source: TransactionSource,
  registry: ScriptRegistry,
  hash: string | null,
) {
  return useQuery<EnrichedTransaction, Error>({
    queryKey: ['tx', source.network, hash],
    enabled: hash !== null,
    queryFn: async () => {
      if (!isValidTxHash(hash!)) {
        throw new VizError('invalid-hash', 'Not a valid transaction hash')
      }
      const tx = await source.getTransaction(hash!)
      return enrichTransaction(tx, registry)
    },
    retry: (count, error) => !isVizError(error) && count < 2,
  })
}
