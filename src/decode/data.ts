import type { Cell, DecodedData, Network, Script } from '@/domain/types'
import { byteLength } from '@/domain/hex'
import { formatInt } from '@/domain/units'
import type { KnownScriptId } from '@/registry/codeHashes'
import type { ScriptRegistry } from '@/registry/registry'
import { decodeDaoCell } from './dao'
import { decodeClusterData, decodeSporeData } from './molecule'
import { lookupToken } from './tokens'
import { decodeUdtAmount, formatUdtAmount } from './udt'

/** Registry ids whose cells carry a UDT balance (16-byte LE amount). */
export const UDT_TYPE_IDS = new Set<KnownScriptId>(['sudt', 'xudt', 'usdi', 'rusd', 'ccbtc', 'wckb'])

/** Is this type script a UDT — either a named token, or a generic sUDT/xUDT? */
export function isUdtType(network: Network, type: Script, registry: ScriptRegistry): boolean {
  if (lookupToken(network, type)) return true
  const id = registry.identify(type)
  return id !== undefined && UDT_TYPE_IDS.has(id)
}

/**
 * Decode a cell's data to meaning, grounded in the type script's known identity
 * — never on data length alone (SPEC §8). Best-effort and always labeled
 * inferred; falls back to raw hex for anything unrecognized.
 */
export function decodeCellData(cell: Cell, network: Network, registry: ScriptRegistry): DecodedData {
  const type = cell.type
  if (!type) {
    return byteLength(cell.data) === 0 ? { kind: 'empty', inferred: false } : rawData(cell.data)
  }

  if (isUdtType(network, type, registry)) {
    const amount = decodeUdtAmount(cell.data)
    if (amount === null) return rawData(cell.data)
    const token = lookupToken(network, type)
    const label = token
      ? `${formatUdtAmount(amount, token.decimals)} ${token.symbol}`
      : `${formatInt(amount)} units`
    const decoded: DecodedData = { kind: 'udt', label, inferred: true, udtAmount: amount }
    if (token) {
      decoded.udtSymbol = token.symbol
      decoded.udtDecimals = token.decimals
    }
    return decoded
  }

  switch (registry.identify(type)) {
    case 'nervosDao': {
      const dao = decodeDaoCell(cell.data)
      if (!dao) return rawData(cell.data)
      if (dao.phase === 'deposit') return { kind: 'dao-deposit', label: 'DAO deposit', inferred: true }
      const decoded: DecodedData = {
        kind: 'dao-withdraw',
        label: `DAO withdrawal · deposit block ${formatInt(dao.depositBlock ?? 0n)}`,
        inferred: true,
      }
      if (dao.depositBlock !== null) decoded.daoDepositBlock = dao.depositBlock
      return decoded
    }

    case 'spore': {
      const spore = decodeSporeData(cell.data)
      if (!spore) return rawData(cell.data)
      const decoded: DecodedData = {
        kind: 'spore',
        label: spore.contentType || 'Spore',
        inferred: true,
        contentType: spore.contentType,
        contentByteLength: spore.contentByteLength,
      }
      if (spore.clusterId) decoded.clusterId = spore.clusterId
      if (spore.imageDataUri) decoded.imageDataUri = spore.imageDataUri
      return decoded
    }

    case 'cluster': {
      const cluster = decodeClusterData(cell.data)
      if (!cluster) return rawData(cell.data)
      return { kind: 'cluster', label: cluster.name || 'Cluster', inferred: true, clusterName: cluster.name }
    }

    default:
      return rawData(cell.data)
  }
}

function rawData(dataHex: string): DecodedData {
  return { kind: 'raw', label: `${formatInt(byteLength(dataHex))} bytes`, inferred: false }
}
