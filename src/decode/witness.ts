import { byteLength } from '@/domain/hex'
import { bytesFieldPayload, readTableFields } from './molecule'

/**
 * Best-effort decode of a witness as `WitnessArgs { lock, input_type,
 * output_type }` (SPEC §8.7). A witness may legitimately not be WitnessArgs —
 * some scripts consume a raw byte string — so this fails soft, reporting the
 * raw length and which optional fields are present (by byte length).
 */
export interface WitnessView {
  isWitnessArgs: boolean
  totalBytes: number
  lock?: number
  inputType?: number
  outputType?: number
}

export function decodeWitness(hex: string): WitnessView {
  const totalBytes = byteLength(hex)
  if (totalBytes === 0) return { isWitnessArgs: false, totalBytes }
  try {
    const fields = readTableFields(hex)
    if (fields.length !== 3) return { isWitnessArgs: false, totalBytes }
    const view: WitnessView = { isWitnessArgs: true, totalBytes }
    if (fields[0]!.length > 0) view.lock = bytesFieldPayload(fields[0]!).length
    if (fields[1]!.length > 0) view.inputType = bytesFieldPayload(fields[1]!).length
    if (fields[2]!.length > 0) view.outputType = bytesFieldPayload(fields[2]!).length
    return view
  } catch {
    return { isWitnessArgs: false, totalBytes }
  }
}
