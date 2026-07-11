import type { Cell, DecodedData, Network } from '@/domain/types'
import { byteLength } from '@/domain/hex'
import { formatInt } from '@/domain/units'
import type { ScriptRegistry } from '@/registry/registry'
import { decodeDaoCell } from './dao'
import { decodeClusterData, decodeSporeData } from './molecule'
import { lookupToken } from './tokens'
import { decodeUdtAmount, formatUdtAmount } from './udt'

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

  switch (registry.identify(type)) {
    case 'sudt':
    case 'xudt': {
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
