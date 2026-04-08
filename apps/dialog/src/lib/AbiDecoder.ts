import {
  type Abi,
  type AbiParameter,
  type Hex,
  decodeFunctionData,
  parseAbi,
} from 'viem'

export interface DecodedFunction {
  name: string
  signature: string
  args: DecodedArg[]
}

export interface DecodedArg {
  name: string
  type: string
  value: unknown
}

function parseFunctionSignature(signature: string): Abi | null {
  try {
    return parseAbi([`function ${signature}` as never])
  } catch {
    return null
  }
}

function extractParams(
  inputs: readonly AbiParameter[],
  values: readonly unknown[] | Record<string, unknown>,
): DecodedArg[] {
  const isArray = Array.isArray(values)
  const valuesObj = values as Record<string, unknown>
  const valuesArr = values as readonly unknown[]

  return inputs.map((input, idx) => {
    const paramName = input.name || `arg${idx}`
    const value = isArray
      ? valuesArr[idx]
      : (valuesObj[paramName] ??
        valuesObj[input.name || ''] ??
        valuesObj[String(idx)] ??
        undefined)

    return { name: paramName, type: input.type, value }
  })
}

export function tryDecodeFunctionData(
  signature: string | null,
  data: Hex,
): DecodedFunction | null {
  if (!signature || !data || data === '0x' || data.length < 10) return null

  const abi = parseFunctionSignature(signature)
  if (!abi) return null

  try {
    const decoded = decodeFunctionData({ abi, data })
    const fnAbi = abi.find(
      (item) => item.type === 'function' && item.name === decoded.functionName,
    )
    if (!fnAbi || fnAbi.type !== 'function') return null

    return {
      args: extractParams(fnAbi.inputs, decoded.args ?? []),
      name: decoded.functionName,
      signature,
    }
  } catch {
    return null
  }
}

export function formatDecodedValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return 'null'

  if (typeof value === 'bigint') return value.toString()

  if (typeof value === 'string' && value.startsWith('0x')) {
    if (value.length > 66) return `${value.slice(0, 34)}...${value.slice(-32)}`
    return value
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    if (value.length <= 3)
      return `[${value.map((v) => formatDecodedValue(v, 'unknown')).join(', ')}]`
    return `[${value.length} items]`
  }

  if (typeof value === 'boolean') return value ? 'true' : 'false'

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '{}'
    if (entries.length <= 2)
      return `{${entries.map(([k, v]) => `${k}: ${formatDecodedValue(v, 'unknown')}`).join(', ')}}`
    return `{${entries.length} fields}`
  }

  // suppress the unused-variable warning from linter
  void type

  return String(value)
}
