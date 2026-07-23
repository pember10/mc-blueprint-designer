/**
 * Minecraft block model resolver.
 *
 * Reads `assets/<namespace>/models/<path>.json` from IndexedDB and resolves
 * the full model by following parent chains (up to depth 12) and merging
 * texture variable maps (child overrides parent).
 */

import { getModelJson } from './textures'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelFace {
  /** UV region in 0-16 space: [u1, v1, u2, v2] */
  uv: [number, number, number, number]
  /** Resolved texture ID, e.g. "minecraft:block/oak_planks" */
  texture: string
  /** Face texture rotation in degrees (0 | 90 | 180 | 270) */
  rotation?: number
  cullface?: string
  tintindex?: number
}

export interface ModelElement {
  from: [number, number, number]
  to: [number, number, number]
  /** Optional per-element rotation */
  rotation?: {
    origin: [number, number, number]
    axis: 'x' | 'y' | 'z'
    angle: number
    rescale?: boolean
  }
  faces: Partial<Record<FaceDir, ModelFace>>
}

export type FaceDir = 'north' | 'south' | 'east' | 'west' | 'up' | 'down'

export interface ResolvedModel {
  elements: ModelElement[]
  /** Resolved textures: variable name → fully-qualified texture ID */
  textures: Record<string, string>
}

// Raw JSON shapes (lenient)
interface RawModel {
  parent?: string
  textures?: Record<string, string>
  elements?: RawElement[]
}

interface RawElement {
  from: [number, number, number]
  to: [number, number, number]
  rotation?: { origin: [number, number, number]; axis: 'x' | 'y' | 'z'; angle: number; rescale?: boolean }
  faces?: Record<string, { uv?: [number, number, number, number]; texture: string; rotation?: number; cullface?: string; tintindex?: number }>
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const resolvedCache = new Map<string, ResolvedModel | null>()

export function clearModelCache(): void {
  resolvedCache.clear()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a model and all its parents, returning the merged element/texture data.
 * Returns null if model data is not loaded or the model is a non-renderable builtin.
 */
export async function resolveModel(modelId: string): Promise<ResolvedModel | null> {
  // Normalise namespace
  if (!modelId.includes(':')) modelId = `minecraft:${modelId}`

  if (resolvedCache.has(modelId)) return resolvedCache.get(modelId)!

  // Follow the parent chain
  const chain: RawModel[] = []
  let cur = modelId
  const visited = new Set<string>()

  while (cur && !visited.has(cur)) {
    visited.add(cur)
    if (cur.includes('builtin/')) break

    const raw = await getModelJson(cur) as RawModel | null
    if (!raw) break

    chain.push(raw)
    if (!raw.parent) break

    let p = raw.parent
    if (!p.includes(':')) p = `minecraft:${p}`
    cur = p
  }

  if (chain.length === 0) {
    resolvedCache.set(modelId, null)
    return null
  }

  // Merge textures: process root→child so child keys override parent
  const mergedTextures: Record<string, string> = {}
  for (const raw of [...chain].reverse()) {
    if (raw.textures) Object.assign(mergedTextures, raw.textures)
  }
  const resolvedTextures = resolveTextureVars(mergedTextures)

  // Elements: take from the first entry in the chain that defines them
  let rawElements: RawElement[] | undefined
  for (const raw of chain) {
    if (raw.elements?.length) { rawElements = raw.elements; break }
  }

  if (!rawElements) {
    resolvedCache.set(modelId, null)
    return null
  }

  // Build resolved elements
  const elements: ModelElement[] = rawElements.map((el) => {
    const faces: Partial<Record<FaceDir, ModelFace>> = {}

    for (const [dir, face] of Object.entries(el.faces ?? {})) {
      const texVar = face.texture.startsWith('#') ? face.texture.slice(1) : face.texture
      const texId = resolvedTextures[texVar] ?? resolvedTextures[face.texture] ?? face.texture

      // Default UV: auto-calculate from element bounds if not specified
      const uv: [number, number, number, number] = face.uv
        ? face.uv
        : defaultUV(dir as FaceDir, el.from, el.to)

      faces[dir as FaceDir] = {
        uv,
        texture: texId.includes(':') ? texId : `minecraft:${texId}`,
        rotation: face.rotation,
        cullface: face.cullface,
        tintindex: face.tintindex,
      }
    }

    return {
      from: el.from,
      to: el.to,
      rotation: el.rotation,
      faces,
    }
  })

  const result: ResolvedModel = { elements, textures: resolvedTextures }
  resolvedCache.set(modelId, result)
  return result
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveTextureVars(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(raw)) {
    out[key] = resolveVar(raw[key], raw, new Set<string>())
  }
  return out
}

function resolveVar(val: string, map: Record<string, string>, visited: Set<string>): string {
  if (!val.startsWith('#')) return val
  const name = val.slice(1)
  if (visited.has(name)) return val
  visited.add(name)
  const next = map[name]
  if (!next) return val
  return resolveVar(next, map, visited)
}

/**
 * Minecraft's default UV auto-calculation: picks the two axes that span the face.
 * Returns [u1, v1, u2, v2] in 0-16 space.
 */
function defaultUV(
  dir: FaceDir,
  from: [number, number, number],
  to: [number, number, number],
): [number, number, number, number] {
  switch (dir) {
    case 'down':  return [from[0], from[2], to[0], to[2]]  // x, z
    case 'up':    return [from[0], from[2], to[0], to[2]]
    case 'north': return [16 - to[0], 16 - to[1], 16 - from[0], 16 - from[1]]
    case 'south': return [from[0], 16 - to[1], to[0], 16 - from[1]]
    case 'west':  return [from[2], 16 - to[1], to[2], 16 - from[1]]
    case 'east':  return [16 - to[2], 16 - to[1], 16 - from[2], 16 - from[1]]
  }
}
