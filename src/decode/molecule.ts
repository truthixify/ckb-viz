import { hexToBytes, readUintLE } from '@/domain/hex'

/**
 * Minimal, defensive molecule table reader for Spore/Cluster data (SPEC §8.5).
 * A molecule table is a 4-byte LE total size, then a 4-byte LE offset per
 * field, then the field payloads. Each field slice is returned as-is; a `Bytes`
 * field carries its own 4-byte length header, unwrapped by `bytesFieldPayload`.
 */
export function readTableFields(dataHex: string): Uint8Array[] {
  const bytes = hexToBytes(dataHex)
  if (bytes.length < 8) throw new Error('molecule table too short')
  const total = Number(readUintLE(bytes, 0, 4))
  if (total !== bytes.length) throw new Error('molecule size header mismatch')
  const firstOffset = Number(readUintLE(bytes, 4, 4))
  const fieldCount = (firstOffset - 4) / 4
  if (!Number.isInteger(fieldCount) || fieldCount < 0) throw new Error('bad molecule header')

  const offsets: number[] = []
  for (let i = 0; i < fieldCount; i++) offsets.push(Number(readUintLE(bytes, 4 + i * 4, 4)))
  offsets.push(total)

  const fields: Uint8Array[] = []
  for (let i = 0; i < fieldCount; i++) {
    const start = offsets[i]!
    const end = offsets[i + 1]!
    fields.push(bytes.subarray(start, end))
  }
  return fields
}

/** Unwrap a `Bytes` field (4-byte length header) into its payload. */
export function bytesFieldPayload(field: Uint8Array): Uint8Array {
  if (field.length < 4) return new Uint8Array(0)
  return field.subarray(4)
}

const textDecoder = new TextDecoder('utf-8', { fatal: false })

export function utf8(bytes: Uint8Array): string {
  return textDecoder.decode(bytes)
}

export interface SporeData {
  contentType: string
  contentByteLength: number
  clusterId?: string
  /** A data: URI for renderable inline image content. */
  imageDataUri?: string
}

const MAX_INLINE_IMAGE_BYTES = 2_000_000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Best-effort decode of SporeData { content_type, content, cluster_id? }. For
 *  a renderable inline image, builds a data: URI (rendered via <img>, which does
 *  not execute scripts, so even SVG content is safe). */
export function decodeSporeData(dataHex: string): SporeData | null {
  try {
    const fields = readTableFields(dataHex)
    if (fields.length < 2) return null
    const contentType = utf8(bytesFieldPayload(fields[0]!))
    const content = bytesFieldPayload(fields[1]!)
    const result: SporeData = { contentType, contentByteLength: content.length }

    const mime = contentType.split(';')[0]?.trim().toLowerCase()
    if (mime?.startsWith('image/') && content.length > 0 && content.length < MAX_INLINE_IMAGE_BYTES) {
      try {
        result.imageDataUri = `data:${mime};base64,${bytesToBase64(content)}`
      } catch {
        // leave the preview unset if encoding fails
      }
    }

    const clusterField = fields[2]
    if (clusterField && clusterField.length > 0) {
      let hex = '0x'
      for (const b of clusterField) hex += b.toString(16).padStart(2, '0')
      result.clusterId = hex
    }
    return result
  } catch {
    return null
  }
}

export interface ClusterData {
  name: string
  description: string
}

/** Best-effort decode of ClusterData { name, description }. */
export function decodeClusterData(dataHex: string): ClusterData | null {
  try {
    const fields = readTableFields(dataHex)
    if (fields.length < 2) return null
    return {
      name: utf8(bytesFieldPayload(fields[0]!)),
      description: utf8(bytesFieldPayload(fields[1]!)),
    }
  } catch {
    return null
  }
}
