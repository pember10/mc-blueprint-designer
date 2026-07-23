/**
 * Blockstate resolver.
 *
 * Reads `assets/<namespace>/blockstates/<block>.json` from IndexedDB
 * (populated by importMinecraftJar / importResourcePack) and maps a full
 * blockstate string like `minecraft:oak_stairs[facing=east,half=bottom,shape=straight]`
 * to a model reference + rotation for Three.js rendering.
 *
 * Handles the `variants` format only (covers ~90% of vanilla building blocks).
 * The `multipart` format (fences, grass, vines) is deferred.
 */

import { getBlockstateJson } from './textures'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedVariant {
  /** Fully-qualified model ID, e.g. "minecraft:block/oak_stairs" */
  modelId: string
  /** X-axis rotation in degrees (0 | 90 | 180 | 270) */
  xRot: number
  /** Y-axis rotation in degrees (0 | 90 | 180 | 270) */
  yRot: number
  uvlock: boolean
}

interface RawVariantEntry {
  model: string
  x?: number
  y?: number
  uvlock?: boolean
  weight?: number
}

interface BlockstateJson {
  variants?: Record<string, RawVariantEntry | RawVariantEntry[]>
  multipart?: unknown[]
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const cache = new Map<string, ResolvedVariant | null>()

export function clearBlockstateCache(): void {
  cache.clear()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a full blockstate string into namespace, name, and property map.
 * e.g. "minecraft:oak_stairs[facing=east,half=bottom]"
 *   → { namespace: "minecraft", name: "oak_stairs", props: { facing: "east", half: "bottom" } }
 */
export function parseBlockstateString(s: string): {
  namespace: string
  name: string
  props: Record<string, string>
} {
  let id = s
  const props: Record<string, string> = {}

  const bi = s.indexOf('[')
  if (bi !== -1) {
    id = s.slice(0, bi)
    const propsStr = s.slice(bi + 1, s.endsWith(']') ? -1 : undefined)
    for (const pair of propsStr.split(',')) {
      const eq = pair.indexOf('=')
      if (eq !== -1) props[pair.slice(0, eq)] = pair.slice(eq + 1)
    }
  }

  const ci = id.indexOf(':')
  return {
    namespace: ci !== -1 ? id.slice(0, ci) : 'minecraft',
    name: ci !== -1 ? id.slice(ci + 1) : id,
    props,
  }
}

/**
 * Resolve a blockstate string to the model + rotation it should use.
 * Returns null if blockstate data hasn't been loaded yet or block is unsupported.
 */
export async function resolveBlockstate(blockstateStr: string): Promise<ResolvedVariant | null> {
  if (cache.has(blockstateStr)) return cache.get(blockstateStr)!

  const { namespace, name, props } = parseBlockstateString(blockstateStr)
  const bsKey = `${namespace}:${name}`

  const bsJson = await getBlockstateJson(bsKey) as BlockstateJson | null
  if (!bsJson) {
    cache.set(blockstateStr, null)
    return null
  }

  if (bsJson.variants) {
    const raw = matchVariant(bsJson.variants, props)
    if (raw) {
      const entry = Array.isArray(raw) ? raw[0] : raw
      const result = normalise(entry)
      cache.set(blockstateStr, result)
      return result
    }
  }

  // multipart not yet implemented — fall back to null (textured cube)
  cache.set(blockstateStr, null)
  return null
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function matchVariant(
  variants: Record<string, RawVariantEntry | RawVariantEntry[]>,
  props: Record<string, string>,
): RawVariantEntry | RawVariantEntry[] | null {
  // Build the canonical sorted key from the blockstate properties
  const keys = Object.keys(props).sort()
  const normalKey = keys.map((k) => `${k}=${props[k]}`).join(',')

  // 1. Exact match with canonical key
  if (normalKey in variants) return variants[normalKey]

  // 2. Empty key (blocks with no properties, e.g. stone)
  if ('' in variants) return variants['']

  // 3. Partial key match: variant key may specify only a subset of properties
  for (const [varKey, varVal] of Object.entries(variants)) {
    if (varKey === '') continue
    const varProps = Object.fromEntries(
      varKey.split(',').map((s) => {
        const eq = s.indexOf('=')
        return [s.slice(0, eq), s.slice(eq + 1)]
      }),
    )
    if (Object.entries(varProps).every(([k, v]) => props[k] === v)) return varVal
  }

  return null
}

function normalise(entry: RawVariantEntry): ResolvedVariant {
  let modelId = entry.model ?? ''
  // Ensure fully-qualified: "block/oak_stairs" → "minecraft:block/oak_stairs"
  if (!modelId.includes(':')) modelId = `minecraft:${modelId}`
  return {
    modelId,
    xRot: entry.x ?? 0,
    yRot: entry.y ?? 0,
    uvlock: entry.uvlock ?? false,
  }
}
