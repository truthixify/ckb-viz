/**
 * Every failure is a typed value, not a thrown string, so the view can map it
 * deterministically onto the empty / loading / error states (SPEC §9.7, §11.8).
 */

export type VizErrorKind =
  | 'invalid-hash' // the input is not a 0x + 64 hex string
  | 'not-found' // the node reports tx_status unknown, or no such tx
  | 'network' // fetch / CORS / endpoint failure
  | 'rpc' // a well-formed JSON-RPC error from the node
  | 'decode' // a value could not be decoded (soft — usually non-fatal)
  | 'unsupported' // the source cannot do this (e.g. forward lineage on a node)

export class VizError extends Error {
  readonly kind: VizErrorKind
  readonly detail?: string

  constructor(kind: VizErrorKind, message: string, detail?: string) {
    super(message)
    this.name = 'VizError'
    this.kind = kind
    if (detail !== undefined) this.detail = detail
  }
}

export function isVizError(value: unknown): value is VizError {
  return value instanceof VizError
}

/** A plain-language "what happened / what to do" for each error kind. */
export function describeError(err: unknown): { title: string; body: string } {
  if (isVizError(err)) {
    switch (err.kind) {
      case 'invalid-hash':
        return {
          title: 'That is not a transaction hash',
          body: 'A CKB transaction hash is "0x" followed by 64 hexadecimal characters.',
        }
      case 'not-found':
        return {
          title: 'No such transaction on this network',
          body: 'The node has never seen this hash, or it was evicted. Try the other network.',
        }
      case 'network':
        return {
          title: 'Could not reach the endpoint',
          body:
            err.detail ??
            'The node did not respond. Check the endpoint, or that it allows cross-origin requests.',
        }
      case 'rpc':
        return { title: 'The node returned an error', body: err.message }
      case 'unsupported':
        return { title: 'Not available from this source', body: err.message }
      case 'decode':
        return { title: 'Could not decode', body: err.message }
    }
  }
  return {
    title: 'Something went wrong',
    body: err instanceof Error ? err.message : 'An unexpected error occurred.',
  }
}
